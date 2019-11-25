pragma solidity 0.5.11;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Ownable } from "@openzeppelin/contracts/ownership/Ownable.sol";
import { IMaticToken } from "./IMaticToken.sol";


contract MaticErc721 is ERC721, Ownable {
  /**
   * @dev Emits Transfer(owmsg.senderner, address(0), tokenId);
   */
  function burn(uint256 tokenId) public {
    _burn(msg.sender, tokenId);
  }

  /**
   * @dev Emits emit Transfer(address(0), to, tokenId);
   */
  function mint(address to, uint256 tokenId) public onlyOwner {
    _mint(to, tokenId);
  }
}