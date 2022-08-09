const { network, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

module.exports = async (hre) => {
    const { getNamedAccounts, deployments } = hre;
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts(); //this helps name the accounts like privatekey01 into eg "deployer"
    const chainId = network.config.chainId; //adding the chainId

    const FUND_SUB_AMOUNT = ethers.utils.parseEther("2");

    let vrfCoordinatorV2Address, subscriptionId;
    if (developmentChains.includes(network.name)) {
        const vrfCoordinatorV2 = await ethers.getContract("VRFCoordinatorV2Mock");
        vrfCoordinatorV2Address = vrfCoordinatorV2.address;
        const transactionResponse = await vrfCoordinatorV2.createSubscription();
        const transactionRecipt = await transactionResponse.wait(1);
        subscriptionId = transactionRecipt.events[0].args.subId; //derived subId by emiting an event
        //fund the subscribtion
        // usually, you'd need the link token on a real network but for this mock you can pay the sub without paying
        await vrfCoordinatorV2.fundSubscription(subscriptionId, FUND_SUB_AMOUNT);
    } else {
        //console.log("THis is the chainID  " + chainId);

        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"];
        subscriptionId = networkConfig[chainId]["subscriptionId"];
    }

    const entranceFee = networkConfig[chainId]["entranceFee"];
    const gasLane = networkConfig[chainId]["gasLane"]; //constructor agrs for raffle.sol
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
    const interval = networkConfig[chainId]["interval"];

    const args = [
        vrfCoordinatorV2Address,
        entranceFee,
        gasLane,
        subscriptionId,
        callbackGasLimit,
        interval,
    ];
    const raffle = await deploy("Raffle", {
        from: deployer, //named accounts
        args: args, //put the priceFeed address of the network you want to work with
        log: true,
        waitConformations: network.config.blockConfirmations || 6, // if blockConfirmations is not specified wait for only 1 block
    });

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        await verify(raffle.address, args);
    }

    log("Deployed-----------------------------------------------------------");
};

module.exports.tags = ["all", "raffle"];
