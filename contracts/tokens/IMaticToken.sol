pragma solidity 0.5.11;


interface IMaticToken {
  event Transfer(address indexed from, address indexed to, uint256 value);
  function burn(uint256 amount) external;
  function mint(address account, uint256 amount) external;
}