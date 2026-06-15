/**
 * RF21: Avisos e Alertas no Dashboard — condição crítica de campanha sem voluntários.
 *
 * Resultado esperado: numa campanha sem inscritos, o painel Voluntários mostra
 * o aviso «Ainda sem voluntários».
 *
 * Pré-requisitos:
 * - API Mariva a correr (http://127.0.0.1:3000)
 * - Frontend a correr (http://localhost:5173)
 * - Base de dados com seed: pnpm run db:seed (password Demo2026!)
 *
 * Executar: node "tests/RF21.js"
 */

const { By, until } = require("selenium-webdriver");
const { criarDriver } = require("../criar-driver");
const SEED = require("../test-seed");

const BASE_URL = process.env.APP_URL || "http://localhost:5173";
const EMAIL = process.env.TEST_EMAIL || SEED.EMAIL;
const PASSWORD = process.env.TEST_PASSWORD || SEED.PASSWORD;

const CAMPAIGN_ID =
  process.env.CAMPAIGN_ID || SEED.CAMPAIGNS.empty.id;
const CAMPANHA_TITULO =
  process.env.CAMPAIGN_TITLE || SEED.CAMPAIGNS.empty.title;

const TESTE_ID = "RF21";
const { createEvidencias } = require("../tc-evidencias");
const { executarPasso, screenshotErro } = createEvidencias(TESTE_ID);
const DELAY_ENTRE_PASSOS_MS = Number(process.env.TEST_DELAY_MS) || 1200;
const DELAY_DIGITACAO_MS = Number(process.env.TEST_TYPING_MS) || 50;

async function pausa(driver, ms = DELAY_ENTRE_PASSOS_MS) {
  await driver.sleep(ms);
}

async function escreverLentamente(elemento, texto, msPorCaracter = DELAY_DIGITACAO_MS) {
  await elemento.clear();
  for (const char of texto) {
    await elemento.sendKeys(char);
    await new Promise((resolve) => setTimeout(resolve, msPorCaracter));
  }
}

async function fazerLogin(driver) {
  await driver.manage().deleteAllCookies();
  await driver.get(`${BASE_URL}/entrar`);
  await driver.manage().window().maximize();

  const email = await driver.wait(
    until.elementLocated(By.id("login-email")),
    15000,
  );
  const password = await driver.findElement(By.id("login-password"));
  const entrar = await driver.findElement(
    By.xpath("//button[@type='submit' and contains(., 'Entrar')]"),
  );

  await pausa(driver);
  await escreverLentamente(email, EMAIL);
  await pausa(driver, 600);
  await escreverLentamente(password, PASSWORD);
  await pausa(driver, 600);
  await entrar.click();

  await driver.wait(until.urlContains("/dashboard"), 20000);
  await pausa(driver);
  console.log("Sessão iniciada (admin).");
}

async function aguardarCampanhaCarregada(driver) {
  await driver.wait(async () => {
    const aCarregar = await driver.findElements(
      By.xpath("//*[contains(normalize-space(),'A carregar detalhes')]"),
    );
    return aCarregar.length === 0;
  }, 30000);

  await driver.wait(
    until.elementLocated(By.css('[id^="campaign-tab-"]')),
    20000,
  );
}

async function verificarAvisoCampanhaSemVoluntarios(driver) {
  await driver.get(`${BASE_URL}/campanhas/${CAMPAIGN_ID}/informacoes`);
  await aguardarCampanhaCarregada(driver);

  const tabVoluntarios = await driver.wait(
    until.elementLocated(By.id("campaign-tab-voluntarios")),
    15000,
  );
  await pausa(driver, 450);
  await tabVoluntarios.click();

  await driver.wait(
    until.elementLocated(By.id("campaign-panel-voluntarios")),
    15000,
  );

  const aviso = await driver.wait(
    until.elementLocated(
      By.xpath("//*[normalize-space()='Ainda sem voluntários']"),
    ),
    15000,
  );
  const textoAviso = (await aviso.getText()).trim();
  if (!textoAviso.includes("Ainda sem voluntários")) {
    throw new Error(
      `Aviso esperado «Ainda sem voluntários»; obtido: «${textoAviso}».`,
    );
  }

  const titulo = await driver.findElement(
    By.xpath(
      `//h2[contains(normalize-space(), ${JSON.stringify(CAMPANHA_TITULO.slice(0, 18))})]`,
    ),
  );
  console.log(
    `Alerta confirmado na campanha «${(await titulo.getText()).trim()}»: ${textoAviso}`,
  );
}

async function main() {
  const driver = await criarDriver();

  try {
    console.log("=== RF21 ===");
    await executarPasso(
      driver,
      1,
      "Login como administrador",
      "login",
      () => fazerLogin(driver),
    );
    await executarPasso(
      driver,
      2,
      "Verificar aviso de campanha sem voluntários",
      "aviso_sem_voluntarios",
      () => verificarAvisoCampanhaSemVoluntarios(driver),
    );

    console.log("=== Teste concluído com sucesso ===");
  } catch (erro) {
    console.error("=== Teste falhou ===");
    console.error(erro);
    try {
      await screenshotErro(driver);
    } catch (e) {
      console.error("Não foi possível guardar screenshot de erro:", e.message);
    }
    process.exitCode = 1;
  } finally {
    console.log(`Evidências em: evidencias/${TESTE_ID}/`);
    await pausa(driver, 2000);
    // await driver.quit();
  }
}

main().catch((erro) => {
  console.error("Erro ao executar o script:", erro);
  process.exit(1);
});
