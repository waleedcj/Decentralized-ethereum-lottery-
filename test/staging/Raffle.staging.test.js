const { deployments, ethers, getNamedAccounts, network } = require("hardhat");
const { assert, expect } = require("chai");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");
const { isCallTrace } = require("hardhat/internal/hardhat-network/stack-traces/message-trace");

developmentChains.includes(network.name) //this will only run on testnet
    ? describe.skip //we can skip this is it is on a local HH network by using a turnery operator "?"
    : describe("Raffle", function () {
          let raffle;
          let deployer;
          let entranceFee;
          //const sendValue = ethers.utils.formatEther("10000000000000000"); //we need to give some value to the test and we parse it from 10^18 gewi to 1 ether
          beforeEach(async function () {
              // deploy our fundMe contract
              //using hardhat-deploy
              //const accounts = await ethers.getSigners()
              //const accountZero = accounts[0]
              deployer = (await getNamedAccounts()).deployer; //const {deployer} = await getNamedAccounts();
              raffle = await ethers.getContract("Raffle", deployer); //this getContract will get you the most recent contract deployed, when we call fundme it will be from the deployer
              entranceFee = await raffle.getEntranceFee();
          });

          describe("fullfillRandomWords", function () {
              it("works with live chainLink keepers and chainLink VRF, we get a random winner", async function () {
                  //enter the raffle only
                  const startingTimeStamp = await raffle.getLastTimeStamp(); //just to seee things kickoff and see if it moved forward
                  const accounts = await ethers.getSigners();
                  const winnerStartingBalance = await accounts[0].getBalance();
                  console.log("Setting up Listener...");
                  await new Promise(async (resolve, reject) => {
                      raffle.once("winnerPicked", async () => {
                          console.log("winnerPicked event fired!");

                          try {
                              const recentWinner = await raffle.getrecentWinner();
                              const raffleSate = await raffle.getRaffleState();
                              const winnerEndingBalance = await accounts[0].getBalance();
                              const endingTimeStamp = await raffle.getLastTimeStamp();

                              await expect(raffle.getPlayer(0)).to.be.reverted;
                              console.log("array reset to 0 done!!");
                              assert.equal(recentWinner.toString(), accounts[0].address);
                              console.log("comapre address done");
                              assert.equal(raffleSate.toString(), "0");
                              console.log("raffle state to open done!!");
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance.toString()
                              );
                              console.log("balances done!!!");

                              assert(endingTimeStamp > startingTimeStamp);
                              console.log("time stamp done!!!!!");
                              resolve();
                          } catch (error) {
                              console.log(error);
                              reject(error);
                          }
                      });

                      console.log("Entering Raffle...");
                      const tx = await raffle.enterRaffle({ value: entranceFee });
                      await tx.wait(1);
                      console.log("Ok, time to wait...");
                  });
              });
          });
      });
