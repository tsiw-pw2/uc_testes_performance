/**
 * Cria o WebDriver Chrome.
 *
 * Ordem de resolução do ChromeDriver:
 * 1. CHROMEDRIVER_PATH no .env
 * 2. Pacote npm «chromedriver» (versão alinhada com o Chrome no package.json)
 *
 * Chrome: CHROME_BIN ou localização por defeito no macOS.
 */
const fs = require("fs");
const { Builder } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

const MAC_CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

function resolveChromeBinary() {
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN;
  }
  for (const caminho of MAC_CHROME_PATHS) {
    if (fs.existsSync(caminho)) return caminho;
  }
  return null;
}

function resolveChromeDriverPath() {
  if (process.env.CHROMEDRIVER_PATH && fs.existsSync(process.env.CHROMEDRIVER_PATH)) {
    return process.env.CHROMEDRIVER_PATH;
  }

  try {
    const chromedriver = require("chromedriver");
    if (chromedriver?.path && fs.existsSync(chromedriver.path)) {
      return chromedriver.path;
    }
  } catch (err) {
    console.warn(
      `[AVISO] Pacote chromedriver em falta. Corre «pnpm install» na pasta testes_projeto. (${err.message})`,
    );
  }

  return null;
}

function createChromeOptions() {
  const options = new chrome.Options();
  options.excludeSwitches("enable-logging");
  options.addArguments("--log-level=3");
  options.addArguments("--silent");

  const binary = resolveChromeBinary();
  if (binary) {
    options.setChromeBinaryPath(binary);
  } else {
    console.warn(
      "[AVISO] Google Chrome não encontrado. Instala o Chrome ou define CHROME_BIN no .env.",
    );
  }

  return options;
}

async function criarDriver() {
  const options = createChromeOptions();
  const builder = new Builder().forBrowser("chrome").setChromeOptions(options);

  const driverPath = resolveChromeDriverPath();
  if (!driverPath) {
    throw new Error(
      "ChromeDriver não encontrado. Corre «pnpm install» em testes_projeto ou define CHROMEDRIVER_PATH no .env.",
    );
  }

  builder.setChromeService(new chrome.ServiceBuilder(driverPath));
  console.log(`ChromeDriver: ${driverPath}`);

  const binary = resolveChromeBinary();
  if (binary) {
    console.log(`Chrome: ${binary}`);
  }

  return builder.build();
}

module.exports = {
  criarDriver,
  createChromeOptions,
  resolveChromeBinary,
  resolveChromeDriverPath,
};
