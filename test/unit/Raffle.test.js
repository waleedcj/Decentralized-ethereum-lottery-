const { deployments, ethers, getNamedAccounts, network } = require("hardhat");
const { assert, expect } = require("chai");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");
const { isCallTrace } = require("hardhat/internal/hardhat-network/stack-traces/message-trace");

!developmentChains.includes(network.name) //this will only run on dev chain
    ? describe.skip //we can skip this is it is on a local HH network by using a turnery operator "?"
    : describe("Raffle", function () {
          let raffle;
          let deployer;
          let VRFCoordinatorV2Mock;
          let entranceFee;
          let interval;
          const chainId = network.config.chainId;
          //const sendValue = ethers.utils.formatEther("10000000000000000"); //we need to give some value to the test and we parse it from 10^18 gewi to 1 ether
          beforeEach(async function () {
              // deploy our fundMe contract
              //using hardhat-deploy
              //const accounts = await ethers.getSigners()
              //const accountZero = accounts[0]
              deployer = (await getNamedAccounts()).deployer; //const {deployer} = await getNamedAccounts();
              await deployments.fixture("all"); //fixture deploys all the deployment scripts in which module.export.tags ("all") same as getContractFactory
              raffle = await ethers.getContract("Raffle", deployer); //this getContract will get you the most recent contract deployed, when we call fundme it will be from the deployer
              VRFCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer); //to get the priceFeed
              entranceFee = await raffle.getEntranceFee();
              interval = await raffle.getInterval();
          });

          describe("constructor", function () {
              it("sets the values and compares with each other correctly", async function () {
                  const s_entranceFee = await raffle.getEntranceFee();
                  assert.equal(s_entranceFee.toString(), networkConfig[chainId]["entranceFee"]);

                  const raffleState = await raffle.getRaffleState();
                  assert.equal(raffleState.toString(), "0");

                  assert.equal(interval, networkConfig[chainId]["interval"]);
              });
          });

          describe("EnterRaffle", function () {
              it("reverts when you dont pay enought", async function () {
                  await expect(raffle.enterRaffle()).to.be.revertedWith(
                      //expect is a new keyword it will be expecting somthing to go wrong like reverted
                      "Raffle__NotEnoughETHEntered"
                  );
              });

              it("records players when they enter", async function () {
                  await raffle.enterRaffle({ value: entranceFee });
                  const playerFromContract = await raffle.getPlayer(0);
                  assert.equal(playerFromContract, deployer);
              });

              it("emits event on enter", async function () {
                  await expect(raffle.enterRaffle({ value: entranceFee })).to.emit(
                      //for events
                      raffle,
                      "RaffleEnter"
                  );
              });

              it("it does not allow entrance when raffle is calculating", async function () {
                  await expect(raffle.enterRaffle({ value: entranceFee }));
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]); //we want to instantly increase the time of the blockchain
                  //so we dont have to wait for test to be conducted.
                  await network.provider.send("evm_mine", []); //mine a 1 more block after interval
                  //we pretend to be a chainLink Keeper
                  await raffle.performUpkeep([]); //this will be left empty becuase calldata is empty
                  await expect(raffle.enterRaffle({ value: entranceFee })).to.be.revertedWith(
                      "Raffle__NotOpen"
                  );
              });
          });

          describe("checkUpkeep", function () {
              it("returns false if people havent sent any eth", async function () {
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]); //we want to instantly increase the time of the blockchain
                  //so we dont have to wait for test to be conducted.
                  await network.provider.send("evm_mine", []); //mine a 1 more block after interval
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]); //this function is public in the contract we need to use callStatic so that we dont initiate a transaction
                  //but only return a value
                  assert(!upkeepNeeded); //assert not falase is true we need it to return false becuase we know ppl have not sent eth
              });

              it("returns flase if raffle isnt open", async function () {
                  //everything is true but raffle is not open
                  await raffle.enterRaffle({ value: entranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]); //we want to instantly increase the time of the blockchain
                  //so we dont have to wait for test to be conducted.
                  await network.provider.send("evm_mine", []); //mine a 1 more block after interval
                  await raffle.performUpkeep([]); //this will be left empty becuase calldata is empty
                  const raffleState = await raffle.getRaffleState();
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
                  assert.equal(raffleState.toString(), "1");
                  assert.equal(upkeepNeeded, false);
              });

              it("returns false if enought time hasnt passed", async function () {
                  await raffle.enterRaffle({ value: entranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() - 1]); //we want to instantly increase the time of the blockchain
                  //so we dont have to wait for test to be conducted.
                  await network.provider.send("evm_mine", []); //mine a 1 more block after interval
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
                  assert(!upkeepNeeded);
              });

              it("returns true if enought time has passed, has players, eth, and is open", async function () {
                  await raffle.enterRaffle({ value: entranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]); //we want to instantly increase the time of the blockchain
                  //so we dont have to wait for test to be conducted.
                  await network.provider.send("evm_mine", []); //mine a 1 more block after interval
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
                  assert(upkeepNeeded);
              });
          });

          describe("performUpkeep", function () {
              it("it can only run if checkupkeep is true", async function () {
                  await raffle.enterRaffle({ value: entranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]); //we want to instantly increase the time of the blockchain
                  //so we dont have to wait for test to be conducted.
                  await network.provider.send("evm_mine", []); //mine a 1 more block after interval
                  const tx = await raffle.performUpkeep([]); //this will be left empty becuase calldata is empty
                  assert(tx); //we want to see if check up keep is true and it doesnt break
              });
              it("revert when checkUpkeep is false", async function () {
                  await expect(raffle.performUpkeep([])).to.be.revertedWith(
                      "Raffle_UpkeepNotNeeded"
                  );
              });
              it("Raffle in calculating state", async function () {
                  await raffle.enterRaffle({ value: entranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]); //we want to instantly increase the time of the blockchain
                  //so we dont have to wait for test to be conducted.
                  await network.provider.send("evm_mine", []); //mine a 1 more block after interval
                  await raffle.performUpkeep([]); //this will be left empty becuase calldata is empty
                  const raffleState = await raffle.getRaffleState();
                  assert.equal(raffleState.toString(), "1");
              });
              it("Emits an event", async function () {
                  await raffle.enterRaffle({ value: entranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]); //we want to instantly increase the time of the blockchain
                  //so we dont have to wait for test to be conducted.
                  await network.provider.send("evm_mine", []); //mine a 1 more block after interval
                  await expect(raffle.performUpkeep([])).to.emit(
                      //for events
                      raffle,
                      "RequestedRaffleWinner"
                  );
              });
              it("Calls the vrf coordinator", async function () {
                  await raffle.enterRaffle({ value: entranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]); //we want to instantly increase the time of the blockchain
                  //so we dont have to wait for test to be conducted.
                  await network.provider.send("evm_mine", []); //mine a 1 more block after interval
                  const txResponse = await raffle.performUpkeep([]);
                  const txReceipt = await txResponse.wait(1); //waiting 1 block
                  const requestId = txReceipt.events[1].args.requestId; //we take performUpKeep search for the 1st event after the 0th one and extract the requested Id it emited
                  assert(requestId > 0);
              });
          });
          describe("fullfilRandomWords", function () {
              beforeEach(async function () {
                  await raffle.enterRaffle({ value: entranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]); //we want to instantly increase the time of the blockchain
                  //so we dont have to wait for test to be conducted.
                  await network.provider.send("evm_mine", []); //mine a 1 more block after interval
              });
              it("can only be called after performUpKeep", async function () {
                  await expect(
                      VRFCoordinatorV2Mock.fulfillRandomWords(0, raffle.address) // fulfillRandomWords must have a valid requestId or else it will be reverted with the an error inside the vrfCoordinator mock
                  ).to.be.revertedWith("nonexistent request");
                  await expect(
                      VRFCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)
                  ).to.be.revertedWith("nonexistent request");
              });
              it("picks a winner, resets the lottery, and sends the money", async function () {
                  const additionalEntrants = 6; //ppl who will parttake in the raffle
                  const startingAccountIndex = 1; //since deployer is the 0th account
                  const accounts = await ethers.getSigners();
                  for (
                      let i = startingAccountIndex;
                      i < additionalEntrants + startingAccountIndex;
                      i++
                  ) {
                      const accountConnectedRaffle = raffle.connect(accounts[i]);
                      await accountConnectedRaffle.enterRaffle({ value: entranceFee });
                  }

                  const startingTimeStamp = await raffle.getLastTimeStamp();

                  //performUpKeep (mock being chianlink keepers)
                  //fullfillRandomWords (Mock being the chainLink VRF)
                  //We will have to wait for the fulfillRandomWords to be called
                  //we did it like this because this is how we will wait for it in like the testnet
                  await new Promise(async (resolve, reject) => {
                      raffle.once("winnerPicked", async () => {
                          //calling the once function to set up the listener if winnerPicked is emited or not
                          console.log("gg I found u");
                          try {
                              const recentWinner = await raffle.getrecentWinner();
                              console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$");
                              console.log(recentWinner);
                              console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$");
                              for (let i = 0; i < 8; i++) {
                                  console.log(accounts[i].address);
                              }
                              //making sure assert works
                              const raffleState = await raffle.getRaffleState();
                              const endingTimeStamp = await raffle.getLastTimeStamp();
                              const numPlayers = await raffle.getNumberOfPlayers();
                              const winnerEndingBalance = await accounts[2].getBalance();
                              assert.equal(numPlayers.toString(), "0");
                              assert.equal(raffleState.toString(), "0");
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance // startingBalance + ( (raffleEntranceFee * additionalEntrances) + raffleEntranceFee )
                                      .add(entranceFee.mul(additionalEntrants).add(entranceFee))
                                      .toString()
                              );
                              assert(endingTimeStamp > startingTimeStamp);
                          } catch (e) {
                              reject(e);
                          }
                          resolve();
                      });
                      //setting up the listener
                      //bellow we will fire the event and the listener will pick it up and resolve
                      //we do it inside the promise function becuase winner picked needs to get activated or else it will time out
                      const tx = await raffle.performUpkeep([]); //mocking the chainlink keepers
                      const txReceipt = await tx.wait(1); //this can only be 1 blockconformations
                      const winnerStartingBalance = await accounts[2].getBalance();
                      await VRFCoordinatorV2Mock.fulfillRandomWords(
                          txReceipt.events[1].args.requestId,
                          raffle.address
                      ); //mocking the vrfcoordinator to call its fucntion, if we go the the contract we can see that the sencond event is emiting the reqId thats how we got that
                      //fulfillRandoWords should emit an event call winnerPicked which will fullfill the promise
                  });
              });
          });
      });
