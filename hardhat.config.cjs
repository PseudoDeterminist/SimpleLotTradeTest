require("@nomicfoundation/hardhat-toolbox");
const { subtask } = require("hardhat/config");
const {
  TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS,
} = require("hardhat/builtin-tasks/task-names");

subtask(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS).setAction(
  async (args, hre, runSuper) => {
    const paths = await runSuper(args);
    if (process.env.PROD_COMPILE !== "1") return paths;
    return paths.filter(
      (filePath) =>
        !filePath.includes("/contracts/test/") &&
        !filePath.includes("\\contracts\\test\\")
    );
  }
);

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    local: {
      url: "http://127.0.0.1:8545",
      accounts: "remote",
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      accounts: "remote",
    },
  },
};
