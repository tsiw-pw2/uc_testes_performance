/**
 * RF04: Validar idade mínima (+18) — rejeitar registo de menores de idade.
 *
 * Resultado esperado:
 * - Data de nascimento que não cumpre a idade mínima impede o registo.
 * - O formulário mostra mensagem de erro e mantém o utilizador em /registar.
 * - Data de nascimento válida permite concluir o registo.
 *
 * Pré-requisitos:
 * - API Mariva a correr (http://127.0.0.1:3000)
 * - Frontend a correr (http://localhost:5173)
 *
 * Executar: node "tests/RF04.js"
 */

const { By, until } = require("selenium-webdriver");
const { criarDriver } = require("../criar-driver");

const BASE_URL = process.env.APP_URL || "http://localhost:5173";
const PASSWORD = process.env.REGISTER_PASSWORD || "Demo2026!";

const REGISTO_NOME =
  process.env.REGISTER_NAME || `Voluntário Idade ${Date.now()}`;
const REGISTO_EMAIL_MENOR =
  process.env.REGISTER_EMAIL_MINOR ||
  `selenium.menor.${Date.now()}@teste.pt`;
const REGISTO_EMAIL_VALIDO =
  process.env.REGISTER_EMAIL_VALID ||
  `selenium.maior.${Date.now()}@teste.pt`;

const TESTE_ID = "RF04";
const { createEvidencias } = require("../tc-evidencias");
const { executarPasso, screenshotErro } = createEvidencias(TESTE_ID);
const DELAY_ENTRE_PASSOS_MS = Number(process.env.TEST_DELAY_MS) || 1200;
const DELAY_DIGITACAO_MS = Number(process.env.TEST_TYPING_MS) || 50;

function dataNascimentoComIdade(idadeAnos) {
  const hoje = new Date();
  const ano = hoje.getFullYear() - idadeAnos;
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

const DATA_MENOR_IDADE = process.env.BIRTH_DATE_UNDER_MIN || dataNascimentoComIdade(15);
const DATA_MENOR_CLARA = process.env.BIRTH_DATE_CHILD || "2015-01-01";
const DATA_VALIDA = process.env.BIRTH_DATE_VALID || dataNascimentoComIdade(25);

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

async function abrirPaginaRegisto(driver) {
  await driver.manage().deleteAllCookies();
  await driver.get(`${BASE_URL}/registar`);
  await driver.manage().window().maximize();
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
}

async function preencherFormularioRegisto(driver, { nome, email, dataNascimento }) {
  const nomeEl = await driver.findElement(By.id("register-name"));
  const emailEl = await driver.findElement(By.id("register-email"));
  const dataEl = await driver.findElement(By.id("register-birth-date"));
  const passwordEl = await driver.findElement(By.id("register-password"));
  const confirmarEl = await driver.findElement(By.id("register-confirm-password"));
  const termos = await driver.findElement(
    By.xpath("//form//input[@type='checkbox']"),
  );

  await escreverLentamente(nomeEl, nome);
  await pausa(driver, 350);
  await escreverLentamente(emailEl, email);
  await pausa(driver, 350);
  await preencherCampoData(driver, dataEl, dataNascimento);
  await pausa(driver, 350);
  await escreverLentamente(passwordEl, PASSWORD);
  await pausa(driver, 350);
  await escreverLentamente(confirmarEl, PASSWORD);
  await pausa(driver, 350);

  const termosMarcado = await termos.isSelected();
  if (!termosMarcado) {
    await termos.click();
  }
  await pausa(driver, 500);
}

async function submeterRegisto(driver) {
  const criar = await driver.findElement(
    By.xpath("//button[@type='submit' and contains(normalize-space(),'Criar conta')]"),
  );
  await criar.click();
  await pausa(driver, 1000);
}

async function lerMensagemErroRegisto(driver) {
  const alertas = await driver.findElements(
    By.xpath("//form//*[@role='alert']"),
  );
  for (const alerta of alertas) {
    const texto = (await alerta.getText()).trim();
    if (texto) return texto;
  }
  return null;
}

async function verificarRegistoRejeitadoPorIdade(driver, dataNascimento) {
  await preencherFormularioRegisto(driver, {
    nome: REGISTO_NOME,
    email: REGISTO_EMAIL_MENOR,
    dataNascimento,
  });
  await submeterRegisto(driver);

  const url = await driver.getCurrentUrl();
  if (!url.includes("/registar")) {
    throw new Error(
      `Registo com data ${dataNascimento} devia ser rejeitado; URL: ${url}`,
    );
  }

  const mensagem = await lerMensagemErroRegisto(driver);
  if (!mensagem || !/anos|idade|Minimum age/i.test(mensagem)) {
    throw new Error(
      `Mensagem de idade mínima em falta para ${dataNascimento}; obtido: «${mensagem || "(vazio)"}».`,
    );
  }

  console.log(`Registo rejeitado (${dataNascimento}): ${mensagem}`);
}

async function verificarRegistoAceite(driver) {
  await preencherFormularioRegisto(driver, {
    nome: REGISTO_NOME,
    email: REGISTO_EMAIL_VALIDO,
    dataNascimento: DATA_VALIDA,
  });
  await submeterRegisto(driver);

  await driver.wait(
    until.urlMatches(/\/(campanhas|dashboard|definicoes)/),
    25000,
  );
  await aguardarCarregamento(driver);
  console.log(`Registo aceite com data de nascimento ${DATA_VALIDA}.`);
}

async function main() {
  const driver = await criarDriver();

  try {
    console.log("=== RF04 ===");

    await executarPasso(
      driver,
      1,
      "Abrir página de registo",
      "pagina_registo",
      () => abrirPaginaRegisto(driver),
    );
    await executarPasso(
      driver,
      2,
      "Rejeitar menor de idade",
      "rejeitar_menor_idade",
      () => verificarRegistoRejeitadoPorIdade(driver, DATA_MENOR_IDADE),
    );
    await executarPasso(
      driver,
      3,
      "Rejeitar menor claramente abaixo da idade",
      "rejeitar_menor_claro",
      async () => {
        await abrirPaginaRegisto(driver);
        await verificarRegistoRejeitadoPorIdade(driver, DATA_MENOR_CLARA);
      },
    );
    await executarPasso(
      driver,
      4,
      "Aceitar registo com idade válida",
      "registo_valido",
      async () => {
        await abrirPaginaRegisto(driver);
        await verificarRegistoAceite(driver);
      },
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
