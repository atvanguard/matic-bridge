pragma solidity 0.5.11;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts/ownership/Ownable.sol";
import { IMaticToken } from "./IMaticToken.sol";

contract MaticErc20 is ERC20, Ownable {
  /**
   * @dev Emits Transfer(msg.sender, address(0), amount);
   */
  function burn(uint256 amount) public {
    _burn(msg.sender, amount);
  }

  /**
   * @dev Emits emit Transfer(address(0), account, amount);
   */
  function mint(address account, uint256 amount) public onlyOwner {
    _mint(account, amount);
  }
}