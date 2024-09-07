// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

library CometStructs {
  struct RewardOwed {
    address token;
    uint owed;
  }
}

interface Comet {
  function supply(address asset, uint amount) external;
  function withdraw(address asset, uint amount) external;
  function getSupplyRate(uint utilization) external view returns (uint);
  function getPrice(address priceFeed) external view returns (uint128);
  function baseTrackingSupplySpeed() external view returns (uint);
  function totalSupply() external view returns (uint256);
  function getUtilization() external view returns (uint);
  function baseTokenPriceFeed() external view returns (address);
  function baseIndexScale() external pure returns (uint64);
  function baseScale() external view returns (uint);
}

interface CometRewards {
  function getRewardOwed(address comet, address account) external returns (CometStructs.RewardOwed memory);
  function claim(address comet, address src, bool shouldAccrue) external;
}

interface ERC20 {
  function approve(address spender, uint256 amount) external returns (bool);
  function decimals() external view returns (uint);
  function transfer(address recipient, uint256 amount) external returns (bool);
}

contract Buckslinger {
  address public cometAddress;
  address public owner;
  uint public BASE_MANTISSA;
  uint public BASE_INDEX_SCALE;
  uint constant public DAYS_PER_YEAR = 365;
  uint constant public SECONDS_PER_DAY = 60 * 60 * 24;
  uint constant public SECONDS_PER_YEAR = SECONDS_PER_DAY * DAYS_PER_YEAR;

  constructor(address _cometAddress) {
    owner = msg.sender;
    cometAddress = _cometAddress;
    BASE_MANTISSA = Comet(cometAddress).baseScale();
    BASE_INDEX_SCALE = Comet(cometAddress).baseIndexScale();
  }

  /*
   * Supply an asset that this contract holds to Compound III
   */
  function supply(address asset, uint amount) public {
    if (msg.sender != owner) {
      revert();
    }
    ERC20(asset).approve(cometAddress, amount);
    Comet(cometAddress).supply(asset, amount);
  }

  /*
   * Withdraws an asset from Compound III to this contract
   */
  function withdraw(address asset, uint amount) public {
    if (msg.sender != owner) {
      revert();
    }
    Comet(cometAddress).withdraw(asset, amount);
  }

  /*
   * Send USDC out
   */
  function sendUsdc(address usdc, uint amount, address to) public {
    if (msg.sender != owner) {
      revert();
    }
    ERC20(usdc).transfer(to, amount);
  }

  /*
   * Get the current supply APR in Compound III
   */
  function getSupplyApr() public view returns (uint) {
    Comet comet = Comet(cometAddress);
    uint utilization = comet.getUtilization();
    return comet.getSupplyRate(utilization) * SECONDS_PER_YEAR * 100;
  }

  /*
   * Get the current price of an asset from the protocol's persepctive
   */
  function getCompoundPrice(address singleAssetPriceFeed) public view returns (uint) {
    Comet comet = Comet(cometAddress);
    return comet.getPrice(singleAssetPriceFeed);
  }

  /*
   * Get the current reward for supplying APR in Compound III
   * @param rewardTokenPriceFeed The address of the reward token (e.g. COMP) price feed
   * @return The reward APR in USD as a decimal scaled up by 1e18
   */
  function getRewardAprForSupplyBase(address rewardTokenPriceFeed) public view returns (uint) {
    Comet comet = Comet(cometAddress);
    uint rewardTokenPriceInUsd = getCompoundPrice(rewardTokenPriceFeed);
    uint usdcPriceInUsd = getCompoundPrice(comet.baseTokenPriceFeed());
    uint usdcTotalSupply = comet.totalSupply();
    uint baseTrackingSupplySpeed = comet.baseTrackingSupplySpeed();
    uint rewardToSuppliersPerDay = baseTrackingSupplySpeed * SECONDS_PER_DAY * (BASE_INDEX_SCALE / BASE_MANTISSA);
    uint supplyBaseRewardApr = (rewardTokenPriceInUsd * rewardToSuppliersPerDay / (usdcTotalSupply * usdcPriceInUsd)) * DAYS_PER_YEAR;
    return supplyBaseRewardApr;
  }
}
