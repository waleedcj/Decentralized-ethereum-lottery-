//network config

const { ethers } = require("hardhat");

const networkConfig = {
    31337: {
        name: "localhost",
        entranceFee: ethers.utils.parseEther("0.01"),
        gasLane: "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc",
        callbackGasLimit: "500000", //500,00 max gas
        interval: "30",
    },
    4: {
        name: "rinkeby",
        vrfCoordinatorV2: "0x6168499c0cFfCaCD319c818142124B7A15E857ab",
        entranceFee: ethers.utils.parseEther("0.01"),
        gasLane: "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc",
        subscriptionId: "7819",
        callbackGasLimit: "500000", //500,00 max gas
        interval: "30",
    },
};

const developmentChains = ["hardhat", "localhost"];
const BASE_FEE = ethers.utils.parseEther("0.25"); //// 0.25 is this the premium in LINK?
const GAS_PRICE_LINK = 1e9; // link per gas, is this the gas lane? // 0.000000001 LINK per gas

//chainlink nodes pay the gas fees to give us randomness and do external execution
//so they price of requests change based on the price of gas

module.exports = {
    networkConfig,
    developmentChains,
    BASE_FEE,
    GAS_PRICE_LINK,
}; //module.export so that other JS scripts can interact with it
