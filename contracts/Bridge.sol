pragma solidity 0.5.11;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/ownership/Ownable.sol";


contract Bridge is Ownable {
  event Deposit(address indexed token, uint256 indexed tokenIdOrAmount, address indexed user);
  event Withdraw(address indexed token, uint256 indexed tokenIdOrAmount, address indexed user);

  function deposit(address token, uint256 tokenIdOrAmount, bool isErc721) external {
    if (isErc721) {
      IERC721(token).transferFrom(msg.sender, address(this), tokenIdOrAmount);
    } else {
      require(
        IERC20(token).transferFrom(msg.sender, address(this), tokenIdOrAmount),
        "Erc20: Token transfer failed"
      );
    }
    emit Deposit(token, tokenIdOrAmount, msg.sender);
  }

  function withdraw(address token, uint256 tokenIdOrAmount, address user, bool isErc721) external onlyOwner {
    if (isErc721) {
      IERC721 _token = IERC721(token);
      // if the token doesn't exist (was probably minted on matic), this will revert with
      // "ERC721: operator query for nonexistent token"
      // If token exists but not owned by bridge, tx will revert without an error msg
      _token.transferFrom(address(this), user, tokenIdOrAmount);
    } else {
      IERC20 _token = IERC20(token);
      require(
        _token.balanceOf(address(this)) >= tokenIdOrAmount,
        "Insufficient balance"
      );
      require(
        _token.transfer(user, tokenIdOrAmount),
        "Erc20: Token transfer failed"
      );
    }
    emit Withdraw(token, tokenIdOrAmount, user);
  }
}