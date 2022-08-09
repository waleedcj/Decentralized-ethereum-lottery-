//Mock priceFeed contract for a local hardhat network
const { network } = require("hardhat");
const { developmentChains, BASE_FEE, GAS_PRICE_LINK } = require("../helper-hardhat-config");

module.exports = async (hre) => {
    const { getNamedAccounts, deployments } = hre;
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts(); //this helps name the accounts like privatekey01 into eg "deployer"
    const { chainId } = network.config.chainId; //adding the chainId
    const args = [BASE_FEE, GAS_PRICE_LINK];

    if (developmentChains.includes(network.name)) {
        //is same as developmentChains.includes("localhost")
        log("Local network detected! Deploying mocks...");
        await deploy("VRFCoordinatorV2Mock", {
            contract: "VRFCoordinatorV2Mock",
            from: deployer,
            log: true,
            args: args,
        });
        console.log("Mocks Deployed!!!");
        console.log("----------------------------------------------------");
    }
};

module.exports.tags = ["all", "mocks"];
