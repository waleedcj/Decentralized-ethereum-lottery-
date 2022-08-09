//raffle
//Enter the lottery(paying some amount)
//pick a random winner every miutes -> completly automated
//Winner to be selected every X minutes -> completely automated
//ChainLink oracle > randomness, automated execution chainlink keepers

/*
event storedNum(
    uint256 indexed oldNum;
    uint256 indexed newNum;
    uint256 addedNum;
    address sender;
)

this is an event declaration we will be emitting things of typed
storedNum when we emmit this event we will have 4 parameters 
oldNum, newNum, addesNum, sender
indexed parameters only upto 3 they are much easier to be searched for than non
indexed they are also called topics 
and
non-indexded parameters they are harder to search becuase they get abi encoded 

*/

//SPDX-License-Identifier: MIT

// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";

error Raffle__NotEnoughETHEntered();
error Raffle__TransferFailed();
error Raffle__NotOpen();
error Raffle_UpkeepNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 raffleState);

//inheritance
/**@title A sample Raffle Contract
 * @author Ceejay_da_dj
 * @notice This contract is for creating a sample raffle contract
 * @dev This implements the Chainlink VRF Version 2
 */
contract Raffle is VRFConsumerBaseV2, KeeperCompatibleInterface {
    /** Type Declarations */
    enum RaffleState {
        //if a operations has to many states to define other than 1 or 0 emuns come into this play the have a finate set of constatnt values to declare the state.
        Open,
        Calculating
    }

    /* state Variables */
    // Chainlink VRF variables
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator; //object
    bytes32 private immutable i_gasLane; // The gas lane to use, which specifies the maximum gas price to bump to.
    uint64 private immutable i_subscriptionId; //The subscription ID that this contract uses for funding requests.
    uint16 private constant REQUEST_CONFIRMATIONS = 3; //How many confirmations the Chainlink node should wait before responding. The longer the node waits, the more secure the random value is.
    uint32 private immutable i_callbackGasLimit; //this sets limits of how much computations fullfilRandomwords does we dont want to spend too much gas
    uint32 private constant numWords = 1; //return only 1 random number

    //Raffle Variables
    uint256 private immutable i_entranceFee; //save some gas because constant
    address private s_recentWinner;
    RaffleState private s_raffleState;
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_interval;
    address payable[] private s_player; //this is in storage becuase we will need to change array of players alot and it is payable becuase once a player wins we need to pay them

    /** events */
    event RaffleEnter(address indexed player);
    event RequestedRaffleWinner(uint256 indexed requestId);
    event winnerPicked(address indexed winner);

    constructor(
        address vrfCoordinatorV2, //The address of the Chainlink VRF Coordinator contract.
        uint256 enteranceFee,
        bytes32 gasLane, //keyHash
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2); //To call the requestRnadomWinner func we need the vrfCoordinator contract we wrap the address with the interface so we can work with vrfCoordinator
        i_entranceFee = enteranceFee;
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_raffleState = RaffleState.Open; //the raffle state is open
        s_lastTimeStamp = block.timestamp;
        i_interval = interval;
    }

    function enterRaffle() public payable {
        if (msg.value < i_entranceFee) {
            revert Raffle__NotEnoughETHEntered();
        }
        if (s_raffleState != RaffleState.Open) {
            revert Raffle__NotOpen();
        }
        s_player.push(payable(msg.sender)); //we wrap msg.sender into payble becuase it isnt a payable address but wont work address [] payable is
        //emit an event when we update a dynamic array or mapping
        //Named events with the function name reversed
        emit RaffleEnter(msg.sender);
    }

    /**
     * @dev This is the fucntion that the ChainLink Keeper nodes call
     * they look for the `upKeepNeeded` to return true
     1. our time interval should have passed 
     2. the lottery should have atleast 1 player , and have some eth 
     3. our subscription is funded with LINK
     4. the raffle should be an open state
     */
    function checkUpkeep(
        bytes memory /*checkData*/ //callData doesnt work with string so we change it to memory
    )
        public
        view
        override
        returns (
            bool upkeepNeeded,
            bytes memory /** performData */
        )
    {
        bool isOpen = (RaffleState.Open == s_raffleState);
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        bool hasPlayers = (s_player.length > 0); // array of players must tbe greater than 1
        bool hasBalance = address(this).balance > 0; //check if the player has balance
        upkeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
        return (upkeepNeeded, "0x0");
    }

    //using chainLink VRF this fucntion is going to be called by the chainlink keepers network so it can automatically run
    //external becuase our own contract cannot call this

    function performUpkeep(
        bytes calldata /* performData */ //calldata doesnt work
    ) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert Raffle_UpkeepNotNeeded(
                address(this).balance,
                s_player.length,
                uint256(s_raffleState)
            );
        }
        s_raffleState = RaffleState.Calculating; //raffle closed to enter in calc state
        uint256 requestId = i_vrfCoordinator.requestRandomWords( //return a reqId that def who is reqing this
            i_gasLane, //gasLane tells which is the max gas price are u willing to pay for a request in wei
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            numWords
        );
        emit RequestedRaffleWinner(requestId); //now we can request a random winner
        //2 transaction process
        //if one hackers will try simulate calling it bruteforcing
    }

    //virtual means it is expecting to be overridden
    function fulfillRandomWords(
        uint256, /*requestId*/
        uint256[] memory randomWords
    ) internal override {
        uint256 indexOfWinner = randomWords[0] % s_player.length;
        address payable recentWinner = s_player[indexOfWinner];
        s_recentWinner = recentWinner; //assign winner to state variable
        s_raffleState = RaffleState.Open; // open the raffle for participation
        s_player = new address payable[](0); //reset player array
        s_lastTimeStamp = block.timestamp; //reseting the timeStamp so that ppl can join a new raffle with a new timestamp
        (bool success, ) = recentWinner.call{value: address(this).balance}("You won!!");

        if (!success) {
            revert Raffle__TransferFailed();
        }
        emit winnerPicked(recentWinner);
        //the randomNum is big in value
        //so we will use MOD to derive a number
        //202 % 10? what doesnt divide evenlt into 202 ?
        //20 * 10 = 200
        //202 - 200 = 2
        //hence 2 is the random winner from the array of 10
    }

    //getters
    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_player[index];
    }

    function getrecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getRaffleState() public view returns (RaffleState) {
        return s_raffleState;
    }

    function getNumWords()
        public
        pure
        returns (
            uint256 //view will read from the storage structure of solidity but pure will directly read from the byte that is assinged which is 1
        )
    {
        return numWords;
    }

    function getNumberOfPlayers() public view returns (uint256) {
        return s_player.length;
    }

    function getRequestConfirmations() public pure returns (uint256) {
        return REQUEST_CONFIRMATIONS;
    }

    function getLastTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }
}
