/**
 * RF03: Registar dados de voluntários — registo com Nome, Email e Data de nascimento.
 *
 * Resultado esperado: os dados aparecem corretamente no perfil criado.
 *
 * Pré-requisitos:
 * - API Mariva a correr (http://127.0.0.1:3000)
 * - Frontend a correr (http://localhost:5173)
 *
 * Executar: node "tests/RF03.js"
 */

const fs = require("fs");
const path = require("path");
const { By, until } = require("selenium-webdriver");
const { criarDriver } = require("../criar-driver");

const BASE_URL = process.env.APP_URL || "http://localhost:5173";
const PASSWORD = process.env.REGISTER_PASSWORD || "Demo2026!";

const REGISTO_NOME =
  process.env.REGISTER_NAME || `Voluntário Teste ${Date.now()}`;
const REGISTO_EMAIL =
  process.env.REGISTER_EMAIL ||
  `${Date.now()}@teste.pt`;
const REGISTO_DATA_NASCIMENTO =
  process.env.REGISTER_BIRTH_DATE || "1990-05-15";

const EVIDENCIAS_DIR = path.join(__dirname, "..", "..", "evidencias");
const TESTE_ID = "RF03";
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

async function abrirPaginaLogin(driver) {
  await driver.get(`${BASE_URL}/entrar`);
  await driver.manage().window().maximize();

  await driver.wait(
    until.elementLocated(By.id("login-email")),
    15000,
  );
  await pausa(driver);
  console.log("Página de login aberta.");
}

async function irParaPaginaRegisto(driver) {
  const linkRegisto = await driver.wait(
    until.elementLocated(
      By.xpath(
        "//a[contains(@href,'/registar') or contains(normalize-space(),'Criar conta') or contains(normalize-space(),'Registar')]",
      ),
    ),
    10000,
  );
  await pausa(driver, 450);
  await linkRegisto.click();

  await driver.wait(until.urlContains("/registar"), 15000);
  await driver.wait(
    until.elementLocated(By.id("register-name")),
    15000,
  );
  await pausa(driver);
  console.log("Página de registo aberta.");
}

async function preencherCampoData(driver, elemento, valorIso) {
  await driver.executeScript(
    `
    const el = arguments[0];
    const valor = arguments[1];
    el.value = valor;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    `,
    elemento,
    valorIso,
  );
  const valorGravado = await elemento.getAttribute("value");
  if (valorGravado !== valorIso) {
    throw new Error(
      `Data de nascimento devia ser «${valorIso}»; o campo ficou com «${valorGravado}».`,
    );
  }
}

async function preencherFormularioRegisto(driver) {
  const nome = await driver.findElement(By.id("register-name"));
  const email = await driver.findElement(By.id("register-email"));
  const dataNascimento = await driver.findElement(By.id("register-birth-date"));
  const password = await driver.findElement(By.id("register-password"));
  const confirmar = await driver.findElement(By.id("register-confirm-password"));
  const termos = await driver.findElement(
    By.xpath("//form//input[@type='checkbox']"),
  );

  await escreverLentamente(nome, REGISTO_NOME);
  await pausa(driver, 450);
  await escreverLentamente(email, REGISTO_EMAIL);
  await pausa(driver, 450);
  await preencherCampoData(driver, dataNascimento, REGISTO_DATA_NASCIMENTO);
  await pausa(driver, 450);
  await escreverLentamente(password, PASSWORD);
  await pausa(driver, 450);
  await escreverLentamente(confirmar, PASSWORD);
  await pausa(driver, 450);

  const termosMarcado = await termos.isSelected();
  if (!termosMarcado) {
    await termos.click();
  }
  await pausa(driver, 600);
  console.log("Formulário de registo preenchido (nome, email, data de nascimento).");
}

async function submeterRegisto(driver) {
  const criar = await driver.findElement(
    By.xpath("//button[@type='submit' and contains(normalize-space(),'Criar conta')]"),
  );
  await criar.click();

  await driver.wait(
    until.urlMatches(/\/(campanhas|dashboard|definicoes)/),
    25000,
  );
  await aguardarCarregamento(driver);
  await pausa(driver);
  console.log("Conta criada e sessão iniciada.");
}

async function abrirPerfil(driver) {
  await driver.get(`${BASE_URL}/definicoes/perfil`);
  await driver.wait(until.urlContains("/definicoes/perfil"), 15000);
  await aguardarCarregamento(driver);

  await driver.wait(
    until.elementLocated(By.id("profile-name")),
    15000,
  );
  await pausa(driver);
  console.log("Perfil do utilizador aberto.");
}

async function lerValorResumoPerfil(driver, etiqueta) {
  const valor = await driver.findElement(
    By.xpath(
      `//aside//p[normalize-space()=${JSON.stringify(etiqueta)}]/following-sibling::p[1]`,
    ),
  );
  return (await valor.getText()).trim();
}

async function lerValorCampoPerfil(driver, idCampo) {
  const campo = await driver.findElement(By.id(idCampo));
  return (await campo.getAttribute("value")).trim();
}

async function verificarDadosNoPerfil(driver) {
  const nomeResumo = await lerValorResumoPerfil(driver, "Nome");
  const emailResumo = await lerValorResumoPerfil(driver, "Email");

  const nomeForm = await lerValorCampoPerfil(driver, "profile-name");
  const emailForm = await lerValorCampoPerfil(driver, "profile-email");

  const erros = [];

  if (nomeResumo !== REGISTO_NOME || nomeForm !== REGISTO_NOME) {
    erros.push(
      `Nome: esperado «${REGISTO_NOME}», resumo «${nomeResumo}», formulário «${nomeForm}».`,
    );
  }
  if (emailResumo !== REGISTO_EMAIL || emailForm !== REGISTO_EMAIL) {
    erros.push(
      `Email: esperado «${REGISTO_EMAIL}», resumo «${emailResumo}», formulário «${emailForm}».`,
    );
  }

  if (erros.length > 0) {
    throw new Error(erros.join(" "));
  }

  console.log("Perfil verificado:");
  console.log(`  Nome: ${nomeResumo}`);
  console.log(`  Email: ${emailResumo}`);
  console.log(`  Data de nascimento (registo): ${REGISTO_DATA_NASCIMENTO}`);
}

async function main() {
  const driver = await criarDriver();

  try {
    console.log("=== RF03 ===");
    await executarPasso(driver, 1, "Abrir página de login", "pagina_login", () => abrirPaginaLogin(driver));
    await executarPasso(driver, 2, "Ir para a página de registo", "pagina_registo", () => irParaPaginaRegisto(driver));
    await executarPasso(
      driver,
      3,
      "Formulário de criação de conta com dados preenchidos",
      "formulario_preenchido",
      () => preencherFormularioRegisto(driver),
    );
    await executarPasso(driver, 4, "Submeter registo e criar conta", "conta_criada", () => submeterRegisto(driver), {
      capturar: false,
    });
    await executarPasso(driver, 5, "Perfil com os mesmos dados do registo", "perfil_dados", () => abrirPerfil(driver));
    await executarPasso(driver, 6, "Confirmar correspondência dos dados", "dados_confirmados", () => verificarDadosNoPerfil(driver), {
      capturar: false,
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
    console.log(`Evidências em: evidencias/${TESTE_ID}/`);
    await pausa(driver, 2000);
    // await driver.quit();
  }
}

main().catch((erro) => {
  console.error("Erro ao executar o script:", erro);
  process.exit(1);
});
