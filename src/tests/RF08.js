/**
 * RF08: Registar participação — confirmar limpeza e presença no currículo.
 *
 * Resultado esperado: a participação fica registada no currículo do voluntário (Presença: Presente).
 *
 * Pré-requisitos:
 * - API Mariva a correr (http://127.0.0.1:3000)
 * - Frontend a correr (http://localhost:5173)
 * - Base de dados com seed: pnpm run db:seed (password Demo2026!)
 *
 * Executar: node "tests/RF08.js"
 */

const fs = require("fs");
const path = require("path");
const { By, until } = require("selenium-webdriver");
const { criarDriver } = require("../criar-driver");

const SEED = require("../test-seed");
const {
  abrirSeparadorVoluntarios,
  encontrarLinhaVoluntario,
  xpathLinhaPorEmail,
  aguardarListaVoluntarios,
  escolherOpcaoSelectModal,
  fecharDriver,
} = require("../test-campaign-voluntarios");

const BASE_URL = process.env.APP_URL || "http://localhost:5173";
const EMAIL = process.env.TEST_EMAIL || SEED.EMAIL;
const PASSWORD = process.env.TEST_PASSWORD || SEED.PASSWORD;

/** Campanha em progresso do seed. */
const CAMPAIGN_ID =
  process.env.CAMPAIGN_ID || SEED.CAMPAIGNS.inProgress.id;
const CAMPANHA_TITULO =
  process.env.CAMPAIGN_TITLE || SEED.CAMPAIGNS.inProgress.title;
const VOLUNTARIO_NOME = process.env.VOLUNTEER_NAME || SEED.USERS.volunteer2.name;
const VOLUNTARIO_EMAIL =
  process.env.VOLUNTEER_EMAIL || SEED.USERS.volunteer2.email;
const VOLUNTARIO_ID =
  process.env.VOLUNTEER_USER_ID || SEED.USERS.volunteer2.id;

const EVIDENCIAS_DIR = path.join(__dirname, "..", "..", "evidencias");
const TESTE_ID = "RF08";
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

async function guardarScreenshot(driver, nomeFicheiro) {
  if (!fs.existsSync(EVIDENCIAS_DIR)) {
    fs.mkdirSync(EVIDENCIAS_DIR, { recursive: true });
  }
  const caminho = path.join(EVIDENCIAS_DIR, nomeFicheiro);
  const pngBase64 = await driver.takeScreenshot();
  fs.writeFileSync(caminho, pngBase64, "base64");
  console.log(`Screenshot guardado: ${caminho}`);
  return caminho;
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

  await driver.wait(
    until.urlMatches(/\/(dashboard|campanhas|definicoes)/),
    20000,
  );
  await pausa(driver);
  console.log("Sessão iniciada com sucesso.");
}

async function aguardarCarregamento(driver) {
  await driver.wait(async () => {
    const loading = await driver.findElements(
      By.xpath("//*[contains(normalize-space(),'A carregar')]"),
    );
    return loading.length === 0;
  }, 20000);
}

function xpathLinhaVoluntarioAtual() {
  return xpathLinhaPorEmail(VOLUNTARIO_EMAIL);
}

async function aguardarTituloCampanha(driver) {
  await driver.wait(
    until.elementLocated(
      By.xpath(
        `//h2[contains(normalize-space(), ${JSON.stringify(CAMPANHA_TITULO)})]`,
      ),
    ),
    20000,
  );
}

async function aguardarVoluntarioNaTabela(driver) {
  await encontrarLinhaVoluntario(driver, {
    email: VOLUNTARIO_EMAIL,
    nome: VOLUNTARIO_NOME,
  });
}

async function abrirVoluntariosCampanha(driver) {
  await abrirSeparadorVoluntarios(driver, BASE_URL, CAMPAIGN_ID);
  await aguardarTituloCampanha(driver);
  await aguardarVoluntarioNaTabela(driver);
  await pausa(driver);
  console.log(`Voluntários da campanha abertos: ${CAMPAIGN_ID}`);
}

async function lerPresencaNaCampanha(driver) {
  const { linha } = await encontrarLinhaVoluntario(driver, {
    email: VOLUNTARIO_EMAIL,
    nome: VOLUNTARIO_NOME,
  });
  const celulas = await linha.findElements(By.css("td"));
  return (await celulas[5].getText()).trim();
}

async function abrirModalGerirInscricao(driver) {
  await aguardarVoluntarioNaTabela(driver);

  const presencaAntes = await lerPresencaNaCampanha(driver);
  console.log(`Presença antes: ${presencaAntes || "(vazio)"}`);

  const botaoGerir = await driver.wait(
    until.elementLocated(
      By.xpath(
        `${xpathLinhaVoluntarioAtual()}//button[@aria-label='Gerir inscrição']`,
      ),
    ),
    10000,
  );
  await pausa(driver, 600);
  await botaoGerir.click();

  await driver.wait(
    until.elementLocated(By.id("edit-registration-title")),
    10000,
  );
  await pausa(driver, 500);
  console.log("Modal «Gerir inscrição» aberto.");
}

async function abrirDropdownPresenca(driver) {
  const modal = await driver.findElement(
    By.xpath(
      "//div[@role='dialog'][.//*[@id='edit-registration-title']]",
    ),
  );
  const combobox = await modal.findElement(By.id("edit-reg-attendance"));
  await combobox.click();
  await pausa(driver, 400);

  await driver.wait(
    until.elementLocated(By.css('[role="listbox"]')),
    10000,
  );
  await pausa(driver, 500);
  console.log("Dropdown de presença aberto.");
}

async function confirmarPresencaPresenteCampanha(driver) {
  const listboxes = await driver.findElements(By.css('[role="listbox"]'));
  if (listboxes.length === 0) {
    await escolherOpcaoSelectModal(driver, "edit-reg-attendance", "Presente");
  } else {
    const opcao = await driver.wait(
      until.elementLocated(
        By.xpath(
          "//div[@role='listbox']//div[@role='option'][.//span[normalize-space()='Presente'] or normalize-space()='Presente']",
        ),
      ),
      10000,
    );
    await opcao.click();
    await pausa(driver, 450);
  }

  const guardar = await driver.findElement(
    By.xpath(
      "//div[@role='dialog'][.//*[@id='edit-registration-title']]//button[normalize-space()='Guardar']",
    ),
  );
  await guardar.click();

  await driver.wait(async () => {
    const modais = await driver.findElements(By.id("edit-registration-title"));
    return modais.length === 0;
  }, 15000);

  await aguardarCarregamento(driver);
  await aguardarListaVoluntarios(driver);
  await pausa(driver);

  const presencaDepois = await lerPresencaNaCampanha(driver);
  if (presencaDepois !== "Sim") {
    throw new Error(
      `Presença na campanha devia ser «Sim»; obtido: «${presencaDepois}».`,
    );
  }

  console.log(
    `Limpeza confirmada para ${VOLUNTARIO_NOME} (presença: ${presencaDepois}).`,
  );
}

async function abrirCurriculoVoluntario(driver) {
  const url = `${BASE_URL}/definicoes/utilizadores/${VOLUNTARIO_ID}/participacoes`;
  await driver.get(url);

  await driver.wait(until.urlContains("/participacoes"), 15000);
  await aguardarCarregamento(driver);

  await driver.wait(
    until.elementLocated(
      By.xpath(
        `//table/tbody/tr[.//a[contains(normalize-space(), ${JSON.stringify(CAMPANHA_TITULO.slice(0, 24))})]]`,
      ),
    ),
    20000,
  );
  await pausa(driver);
  console.log(`Currículo (participações) do voluntário: ${url}`);
}

async function verificarParticipacaoNoCurriculo(driver) {
  const linha = await driver.wait(
    until.elementLocated(
      By.xpath(
        `//table/tbody/tr[.//a[normalize-space()=${JSON.stringify(CAMPANHA_TITULO)}] or .//td[normalize-space()=${JSON.stringify(CAMPANHA_TITULO)}]]`,
      ),
    ),
    20000,
  );

  const celulas = await linha.findElements(By.css("td"));
  const presencaCurriculo = (await celulas[celulas.length - 1].getText()).trim();

  if (presencaCurriculo !== "Presente") {
    throw new Error(
      `Currículo devia mostrar Presença «Presente»; obtido: «${presencaCurriculo}».`,
    );
  }

  const metricas = await driver.findElements(
    By.xpath(
      "//*[normalize-space()='Participações']/following-sibling::*[1] | //*[normalize-space()='Participações']/parent::*//*[contains(@class,'tabular-nums')]",
    ),
  );
  if (metricas.length > 0) {
    const total = (await metricas[0].getText()).trim();
    console.log(`Total de participações no perfil: ${total}`);
  }

  console.log(
    `Participação «${CAMPANHA_TITULO}» no currículo com presença: ${presencaCurriculo}.`,
  );
}

async function main() {
  const driver = await criarDriver();

  try {
    console.log("=== RF08 ===");
    await executarPasso(driver, 1, "Login como administrador", "login", () => fazerLogin(driver));
    await executarPasso(
      driver,
      2,
      "Abrir separador de voluntários",
      "voluntarios_abertos",
      () => abrirVoluntariosCampanha(driver),
    );
    await executarPasso(
      driver,
      3,
      "Modal Gerir inscrição aberto",
      "modal_gerir_inscricao",
      () => abrirModalGerirInscricao(driver),
    );
    await executarPasso(
      driver,
      4,
      "Dropdown de presença aberto",
      "dropdown_presenca_aberto",
      () => abrirDropdownPresenca(driver),
    );
    await executarPasso(
      driver,
      5,
      "Presença confirmada na campanha",
      "presenca_confirmada_campanha",
      () => confirmarPresencaPresenteCampanha(driver),
    );
    await executarPasso(
      driver,
      6,
      "Currículo do voluntário (participações)",
      "curriculo_aberto",
      () => abrirCurriculoVoluntario(driver),
    );
    await executarPasso(
      driver,
      7,
      "Participação com presença Presente no currículo",
      "participacao_verificada",
      () => verificarParticipacaoNoCurriculo(driver),
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
    await fecharDriver(driver);
  }
}

main().catch((erro) => {
  console.error("Erro ao executar o script:", erro);
  process.exit(1);
});
