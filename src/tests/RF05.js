/**
 * RF05: Associar voluntários a campanhas — inscrição numa campanha ativa.
 *
 * Resultado esperado: o nome do voluntário aparece na lista de inscritos (Voluntários).
 *
 * Pré-requisitos:
 * - API Mariva a correr (http://127.0.0.1:3000)
 * - Frontend a correr (http://localhost:5173)
 * - Conta: voluntario2@demo.pt / Demo2026!
 * - Admin (lista de inscritos): admin@demo.pt / Demo2026! (seed)
 *
 * Executar: node "tests/RF05.js"
 */

const fs = require("fs");
const path = require("path");
const { By, until } = require("selenium-webdriver");
const { criarDriver } = require("../criar-driver");

const SEED = require("../test-seed");
const {
  abrirSeparadorVoluntarios,
  encontrarLinhaVoluntario,
  fecharDriver,
} = require("../test-campaign-voluntarios");

const BASE_URL = process.env.APP_URL || "http://localhost:5173";
const PASSWORD_ADMIN = process.env.TEST_PASSWORD || SEED.PASSWORD;

const VOLUNTARIO_EMAIL =
  process.env.VOLUNTEER_EMAIL || SEED.USERS.volunteer2.email;
const VOLUNTARIO_PASSWORD =
  process.env.VOLUNTEER_PASSWORD || SEED.PASSWORD;
const VOLUNTARIO_NOME = process.env.VOLUNTEER_NAME || SEED.USERS.volunteer2.name;
const EMAIL_ADMIN = process.env.ADMIN_EMAIL || SEED.EMAIL;

/** Campanha aberta a inscrições (seed). */
const CAMPAIGN_ID =
  process.env.CAMPAIGN_ID || SEED.CAMPAIGNS.open.id;
const CAMPANHA_TITULO =
  process.env.CAMPAIGN_TITLE || SEED.CAMPAIGNS.open.title;

const EVIDENCIAS_DIR = path.join(__dirname, "..", "..", "evidencias");
const TESTE_ID = "RF05";
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

async function aguardarCarregamento(driver) {
  await driver.wait(async () => {
    const loading = await driver.findElements(
      By.xpath(
        "//*[contains(normalize-space(),'A carregar') or normalize-space()='A carregar…']",
      ),
    );
    return loading.length === 0;
  }, 20000);
}

async function fazerLogin(driver, email, password) {
  await driver.manage().deleteAllCookies();
  await driver.get(`${BASE_URL}/entrar`);
  await driver.manage().window().maximize();

  const campoEmail = await driver.wait(
    until.elementLocated(By.id("login-email")),
    15000,
  );
  const campoPassword = await driver.findElement(By.id("login-password"));
  const entrar = await driver.findElement(
    By.xpath("//button[@type='submit' and contains(., 'Entrar')]"),
  );

  await pausa(driver);
  await escreverLentamente(campoEmail, email);
  await pausa(driver, 600);
  await escreverLentamente(campoPassword, password);
  await pausa(driver, 600);
  await entrar.click();

  await driver.wait(
    until.urlMatches(/\/(dashboard|campanhas|definicoes)/),
    20000,
  );
  await aguardarCarregamento(driver);
  await pausa(driver);
  console.log(`Sessão iniciada: ${email}`);
}

async function terminarSessao(driver) {
  try {
    const menuConta = await driver.wait(
      until.elementLocated(
        By.xpath(
          "//button[@aria-haspopup='menu']//span[normalize-space()='Abrir menu da conta']/ancestor::button | //button[@aria-haspopup='menu']",
        ),
      ),
      8000,
    );
    await pausa(driver, 450);
    await menuConta.click();

    const terminar = await driver.wait(
      until.elementLocated(
        By.xpath(
          "//button[normalize-space()='Terminar sessão' or contains(normalize-space(),'Terminar sessão')]",
        ),
      ),
      8000,
    );
    await pausa(driver, 400);
    await terminar.click();
    await pausa(driver, 1200);
  } catch {
    // Fallback: limpar cookies e abrir login.
  }

  await driver.manage().deleteAllCookies();
  await driver.get(`${BASE_URL}/entrar`);
  await pausa(driver, 600);
  console.log("Sessão terminada.");
}

async function abrirInformacoesCampanha(driver) {
  const url = `${BASE_URL}/campanhas/${CAMPAIGN_ID}/informacoes`;
  await driver.get(url);

  await driver.wait(
    until.elementLocated(
      By.xpath(
        `//h2[contains(normalize-space(), ${JSON.stringify(CAMPANHA_TITULO.slice(0, 20))})]`,
      ),
    ),
    20000,
  );
  await aguardarCarregamento(driver);
  await pausa(driver);
  console.log(`Campanha aberta: ${url}`);
}

async function inscreverNaCampanha(driver) {
  const jaInscrito = await driver.findElements(
    By.xpath("//*[contains(normalize-space(),'A tua inscrição')]"),
  );
  if (jaInscrito.length > 0) {
    console.log("Voluntário já estava inscrito; a saltar clique em Inscrever.");
    return;
  }

  const botaoInscrever = await driver.wait(
    until.elementLocated(
      By.xpath(
        "//button[normalize-space()='Inscrever-me' or (contains(normalize-space(),'Inscrever') and not(contains(normalize-space(),'Cancelar')))]",
      ),
    ),
    10000,
  );
  await pausa(driver, 600);
  await botaoInscrever.click();

  await driver.wait(
    until.elementLocated(
      By.xpath("//*[contains(normalize-space(),'A tua inscrição')]"),
    ),
    20000,
  );
  await aguardarCarregamento(driver);
  await pausa(driver, 800);
  console.log("Inscrição registada (confirmada no painel de informações).");
}

async function abrirListaInscritos(driver) {
  await abrirSeparadorVoluntarios(driver, BASE_URL, CAMPAIGN_ID);
  console.log(`Lista de inscritos aberta (campanha ${CAMPAIGN_ID}).`);
}

async function verificarVoluntarioNaLista(driver) {
  const { linha } = await encontrarLinhaVoluntario(driver, {
    email: VOLUNTARIO_EMAIL,
    nome: VOLUNTARIO_NOME,
  });

  const celulas = await linha.findElements(By.css("td"));
  const nomeNaTabela =
    celulas.length > 0 ? (await celulas[0].getText()).trim() : "";
  const emailNaTabela =
    celulas.length > 1 ? (await celulas[1].getText()).trim() : "";

  if (!emailNaTabela.includes(VOLUNTARIO_EMAIL)) {
    throw new Error(
      `Lista de inscritos devia incluir o e-mail «${VOLUNTARIO_EMAIL}»; obtido: «${emailNaTabela}».`,
    );
  }

  if (VOLUNTARIO_NOME && !nomeNaTabela.includes(VOLUNTARIO_NOME)) {
    throw new Error(
      `Lista de inscritos devia incluir o nome «${VOLUNTARIO_NOME}»; obtido: «${nomeNaTabela}».`,
    );
  }

  console.log(
    `Inscrito na lista: ${nomeNaTabela || "(nome)"} — ${emailNaTabela}`,
  );
}

async function main() {
  const driver = await criarDriver();

  try {
    console.log("=== RF05 ===");
    await executarPasso(driver, 1, "Login como voluntário", "login_voluntario", () => fazerLogin(driver, VOLUNTARIO_EMAIL, VOLUNTARIO_PASSWORD));
    await executarPasso(driver, 2, "Abrir informações da campanha", "campanha_aberta", () => abrirInformacoesCampanha(driver));
    await executarPasso(driver, 3, "Inscrever-se na campanha", "inscricao_realizada", () => inscreverNaCampanha(driver));
    await terminarSessao(driver);
    await executarPasso(driver, 4, "Login como administrador", "login_admin", () => fazerLogin(driver, EMAIL_ADMIN, PASSWORD_ADMIN));
    await executarPasso(driver, 5, "Abrir lista de inscritos", "lista_inscritos", () => abrirListaInscritos(driver));
    await executarPasso(driver, 6, "Confirmar voluntário na lista", "voluntario_confirmado", () => verificarVoluntarioNaLista(driver));

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
