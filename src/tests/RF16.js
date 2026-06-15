/**
 * RF16: Criar Praias — registar nova praia no catálogo.
 *
 * Resultado esperado: a praia é gravada e o toast «Praia criada» fica visível no print.
 *
 * Pré-requisitos:
 * - API Mariva a correr (http://127.0.0.1:3000)
 * - Frontend a correr (http://localhost:5173)
 * - Base de dados com seed: pnpm run db:seed (password Demo2026!)
 *
 * Executar: node "tests/RF16.js"
 */

const fs = require("fs");
const path = require("path");
const { By, until } = require("selenium-webdriver");
const { criarDriver } = require("../criar-driver");

const BASE_URL = process.env.APP_URL || "http://localhost:5173";
const API_URL = process.env.API_URL || "http://127.0.0.1:3000";
const EMAIL = process.env.TEST_EMAIL || "admin@demo.pt";
const PASSWORD = process.env.TEST_PASSWORD || "Demo2026!";

const PREFIXO_PRAIA_TESTE =
  process.env.BEACH_TEST_PREFIX || "Praia Teste Selenium";
const PRAIA_NOME =
  process.env.BEACH_NAME || `${PREFIXO_PRAIA_TESTE} ${Date.now()}`;
const DISTRITO_LABEL = process.env.BEACH_DISTRICT_LABEL || "Braga";
const CONCELHO = process.env.BEACH_MUNICIPALITY || "Esposende";
const LATITUDE = process.env.BEACH_LATITUDE || "41.5000";
const LONGITUDE = process.env.BEACH_LONGITUDE || "-8.7800";

const EVIDENCIAS_DIR = path.join(__dirname, "..", "..", "evidencias");
const TESTE_ID = "RF16";
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

async function apiLogin() {
  const res = await fetch(`${API_URL}/sessions`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(`Login API falhou (${res.status}).`);
  }
  const body = await res.json();
  return body.token || body.session?.token;
}

async function limparPraiasTeste() {
  try {
    const token = await apiLogin();
    const res = await fetch(`${API_URL}/beaches?page=1&pageSize=100`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return;
    const body = await res.json();
    const praias = body.data ?? body.items ?? [];
    for (const praia of praias.filter((p) => p.name.startsWith(PREFIXO_PRAIA_TESTE))) {
      await fetch(`${API_URL}/beaches/${praia.id}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
    }
  } catch {
    // Limpeza opcional; não bloqueia o teste.
  }
}

async function fazerLogin(driver) {
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
    until.urlMatches(/\/(dashboard|campanhas|praias)/),
    20000,
  );
  await pausa(driver);
  console.log("Sessão iniciada com sucesso.");
}

function modalCriarPraia() {
  return By.xpath(
    "//h3[@id='create-beach-title']/ancestor::div[@role='dialog']",
  );
}

async function escolherOpcaoSelect(driver, indiceCombobox, textoOpcao) {
  const modal = await driver.findElement(modalCriarPraia());
  const comboboxes = await modal.findElements(By.css('[role="combobox"]'));
  await comboboxes[indiceCombobox].click();
  await pausa(driver, 400);

  const listbox = await driver.wait(
    until.elementLocated(By.css('[role="listbox"]')),
    10000,
  );
  const opcao = await driver.wait(async () => {
    const candidatas = await listbox.findElements(
      By.xpath(
        `.//*[@role='option'][.//span[normalize-space()=${JSON.stringify(textoOpcao)}] or normalize-space()=${JSON.stringify(textoOpcao)}]`,
      ),
    );
    return candidatas.length > 0 ? candidatas[0] : null;
  }, 15000);

  await driver.executeScript(
    "arguments[0].scrollIntoView({ block: 'nearest' });",
    opcao,
  );
  await opcao.click();
  await pausa(driver, 450);
}

async function criarPraia(driver) {
  await driver.get(`${BASE_URL}/praias`);
  await driver.wait(until.elementLocated(By.id("beaches-tab-list")), 20000);
  await pausa(driver);

  const criar = await driver.wait(
    until.elementLocated(By.xpath("//button[normalize-space()='Criar Praia']")),
    10000,
  );
  await criar.click();
  await driver.wait(until.elementLocated(By.id("create-beach-title")), 10000);
  await pausa(driver);

  const nome = await driver.findElement(
    By.xpath(
      "//h3[@id='create-beach-title']/ancestor::div[@role='dialog']//input[@placeholder='Nome da praia']",
    ),
  );
  await escreverLentamente(nome, PRAIA_NOME);
  await escolherOpcaoSelect(driver, 0, DISTRITO_LABEL);
  await escolherOpcaoSelect(driver, 1, CONCELHO);

  await escreverLentamente(
    await driver.findElement(By.id("create-beach-latitude")),
    LATITUDE,
  );
  await escreverLentamente(
    await driver.findElement(By.id("create-beach-longitude")),
    LONGITUDE,
  );
  await pausa(driver, 400);

  const modal = await driver.findElement(modalCriarPraia());
  const guardar = await modal.findElement(
    By.xpath(".//button[@type='submit' and normalize-space()='Guardar']"),
  );
  await driver.wait(async () => await guardar.isEnabled(), 10000);
  await guardar.click();

  await driver.wait(async () => {
    const texto = await driver.executeScript(`
      const toaster = document.querySelector("[data-sonner-toaster]");
      return toaster ? toaster.innerText : "";
    `);
    const t = (texto || "").toLowerCase();
    return t.includes("praia criada") || t.includes("adicionada ao catálogo");
  }, 20000);

  await pausa(driver, 1000);
  console.log(`Praia criada: ${PRAIA_NOME} · ${CONCELHO} (${DISTRITO_LABEL}).`);
}

async function main() {
  const driver = await criarDriver();

  try {
    console.log("=== RF16 ===");
    console.log(`Nome: ${PRAIA_NOME}`);
    console.log(`Localidade: ${CONCELHO} · ${DISTRITO_LABEL}`);

    await executarPasso(driver, 1, "Login como administrador", "login", () => fazerLogin(driver));
    await limparPraiasTeste();
    await executarPasso(driver, 2, "Clicar no botão Criar Praia", "clicar_criar_praia", async () => {
      await driver.get(`${BASE_URL}/praias`);
      await driver.wait(until.elementLocated(By.id("beaches-tab-list")), 20000);
      await pausa(driver);
      const criar = await driver.wait(
        until.elementLocated(By.xpath("//button[normalize-space()='Criar Praia']")),
        10000,
      );
      await criar.click();
      await driver.wait(until.elementLocated(By.id("create-beach-title")), 10000);
      await pausa(driver);
    });
    await executarPasso(driver, 3, "Preencher formulário da nova praia", "preencher_formulario", async () => {
      const nome = await driver.findElement(
        By.xpath(
          "//h3[@id='create-beach-title']/ancestor::div[@role='dialog']//input[@placeholder='Nome da praia']",
        ),
      );
      await escreverLentamente(nome, PRAIA_NOME);
      await escolherOpcaoSelect(driver, 0, DISTRITO_LABEL);
      await escolherOpcaoSelect(driver, 1, CONCELHO);
      await escreverLentamente(
        await driver.findElement(By.id("create-beach-latitude")),
        LATITUDE,
      );
      await escreverLentamente(
        await driver.findElement(By.id("create-beach-longitude")),
        LONGITUDE,
      );
      await pausa(driver, 400);
    });
    await executarPasso(driver, 4, "Confirmar praia criada com sucesso", "praia_criada_com_sucesso", async () => {
      const modal = await driver.findElement(modalCriarPraia());
      const guardar = await modal.findElement(
        By.xpath(".//button[@type='submit' and normalize-space()='Guardar']"),
      );
      await driver.wait(async () => await guardar.isEnabled(), 10000);
      await guardar.click();
      await driver.wait(async () => {
        const texto = await driver.executeScript(`
          const toaster = document.querySelector("[data-sonner-toaster]");
          return toaster ? toaster.innerText : "";
        `);
        const t = (texto || "").toLowerCase();
        return t.includes("praia criada") || t.includes("adicionada ao catálogo");
      }, 20000);
      await pausa(driver, 1000);
      console.log(`Praia criada: ${PRAIA_NOME} · ${CONCELHO} (${DISTRITO_LABEL}).`);
    });

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
    await limparPraiasTeste();
    console.log(`Evidências em: evidencias/${TESTE_ID}/`);
    await pausa(driver, 2000);
    // await driver.quit();
  }
}

main().catch((erro) => {
  console.error("Erro ao executar o script:", erro);
  process.exit(1);
});
