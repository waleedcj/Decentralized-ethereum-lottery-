//We can add reuseable code used in many different scripts in here like verify contract function
const { run } = require("hardhat");

//to verify our contract on etherscan
async function verify(contractAddress, agrs) {
    console.log("Verify contract.... ");
    try {
        await run("verify:verify", {
            //etherscan verify API run
            address: contractAddress,
            constructorArguments: agrs,
        });
    } catch (e) {
        if (e.message.toLowerCase().includes("already verified")) {
            console.log("Already Verified");
        } else {
            console.log(e);
        }
    }
}

module.exports = { verify };
