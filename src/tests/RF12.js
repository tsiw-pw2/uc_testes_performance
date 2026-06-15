/**
 * RF12: Permitir criar tipos de resíduos — adicionar nova categoria ao catálogo.
 *
 * Resultado esperado: «teste» passa a ser uma opção na lista de tipos (filtro de resíduos).
 *
 * Pré-requisitos:
 * - API Mariva a correr (http://127.0.0.1:3000)
 * - Frontend a correr (http://localhost:5173)
 * - Base de dados com seed: pnpm run db:seed (password Demo2026!)
 *
 * Executar: node "tests/RF12.js"
 */

const fs = require("fs");
const path = require("path");
const { By, until, Key } = require("selenium-webdriver");
const { criarDriver } = require("../criar-driver");

const BASE_URL = process.env.APP_URL || "http://localhost:5173";
const API_URL = process.env.API_URL || "http://127.0.0.1:3000";
const EMAIL = process.env.TEST_EMAIL || "admin@demo.pt";
const PASSWORD = process.env.TEST_PASSWORD || "Demo2026!";

const NOME_TIPO = process.env.WASTE_TYPE_NAME || "teste";

const EVIDENCIAS_DIR = path.join(__dirname, "..", "..", "evidencias");
const TESTE_ID = "RF12";
const { createEvidencias } = require("../tc-evidencias");
const { executarPasso, screenshotErro } = createEvidencias(TESTE_ID);
const DELAY_ENTRE_PASSOS_MS = Number(process.env.TEST_DELAY_MS) || 1200;
const DELAY_DIGITACAO_MS = Number(process.env.TEST_TYPING_MS) || 50;

const TEXTOS_SUCESSO = [
  "categoria criada",
  "nova categoria já pode ser usada",
  "nova categoria ja pode ser usada",
];

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

function normalizarTexto(texto) {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

async function aguardarCarregamento(driver) {
  await driver.wait(async () => {
    const loading = await driver.findElements(
      By.xpath("//*[contains(normalize-space(),'A carregar')]"),
    );
    return loading.length === 0;
  }, 20000);
}

async function preencherInputVue(driver, elemento, texto) {
  await driver.executeScript(
    `
    const el = arguments[0];
    const val = arguments[1];
    el.focus();
    el.value = val;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    `,
    elemento,
    texto,
  );
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

async function apiListarCategorias(token) {
  const res = await fetch(`${API_URL}/waste-categories?page=1&pageSize=100`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Listagem de categorias falhou (${res.status}).`);
  }
  const body = await res.json();
  return body.data ?? body.items ?? [];
}

async function apiEliminarCategoria(token, id) {
  await fetch(`${API_URL}/waste-categories/${id}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
}

async function limparTipoTeste() {
  try {
    const token = await apiLogin();
    const categorias = await apiListarCategorias(token);
    const existente = categorias.find((c) => c.name === NOME_TIPO);
    if (existente) {
      await apiEliminarCategoria(token, existente.id);
      console.log(`Tipo «${NOME_TIPO}» removido (limpeza).`);
    }
  } catch {
    // Limpeza opcional.
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
    until.urlMatches(/\/(dashboard|campanhas|residuos|definicoes)/),
    20000,
  );
  await pausa(driver);
  console.log("Sessão iniciada com sucesso.");
}

async function abrirCategoriasResiduos(driver) {
  await driver.get(`${BASE_URL}/definicoes/categorias-residuos`);
  await driver.wait(
    until.elementLocated(By.id("settings-panel-waste-categories")),
    20000,
  );
  await aguardarCarregamento(driver);
  await pausa(driver);
  console.log("Página «Categorias de resíduos» aberta.");
}

async function adicionarTipo(driver) {
  const painel = await driver.findElement(By.id("settings-panel-waste-categories"));

  const novaCategoria = await painel.findElement(
    By.xpath(".//button[.//span[normalize-space()='Nova categoria']]"),
  );
  await novaCategoria.click();
  await pausa(driver, 600);

  const input = await driver.wait(
    until.elementLocated(
      By.xpath(
        "//*[@id='settings-panel-waste-categories']//input[@placeholder='Nome da categoria']",
      ),
    ),
    10000,
  );

  await driver.wait(until.elementIsVisible(input), 5000);
  await input.click();
  await pausa(driver, 300);
  await preencherInputVue(driver, input, NOME_TIPO);

  await driver.wait(async () => {
    const valor = await input.getAttribute("value");
    return valor === NOME_TIPO;
  }, 5000);

  await pausa(driver, 300);
  await input.sendKeys(Key.ENTER);

  await aguardarToastSucesso(driver);
  await aguardarCarregamento(driver);

  const linha = await painel.findElements(
    By.xpath(`.//button[normalize-space()=${JSON.stringify(NOME_TIPO)}]`),
  );
  if (linha.length === 0) {
    throw new Error(`«${NOME_TIPO}» não aparece na tabela de categorias.`);
  }

  console.log(`Tipo «${NOME_TIPO}» adicionado à lista de categorias.`);
}

async function aguardarToastSucesso(driver) {
  const alvo = TEXTOS_SUCESSO.map(normalizarTexto);
  await driver.wait(async () => {
    const texto = await driver.executeScript(`
      const toaster = document.querySelector("[data-sonner-toaster]");
      return toaster ? toaster.innerText : "";
    `);
    const normalizado = normalizarTexto(texto || "");
    return alvo.some((f) => normalizado.includes(f));
  }, 20000);
  console.log("Categoria criada (toast de sucesso).");
}

async function abrirFiltroCategorias(driver) {
  const filtro = await driver.wait(
    until.elementLocated(By.id("waste-filter-category")),
    15000,
  );
  const combobox = await filtro.findElement(By.css('[role="combobox"]'));
  await combobox.click();
  await pausa(driver, 400);
  return combobox;
}

async function fecharFiltroCategorias(driver, combobox) {
  await combobox.click();
  await pausa(driver, 300);
}

async function lerOpcoesFiltroCategorias(driver) {
  const listbox = await driver.wait(
    until.elementLocated(By.css('div[role="listbox"]')),
    10000,
  );
  const opcoes = await listbox.findElements(
    By.xpath(".//div[@role='option']//span"),
  );
  const nomes = [];
  for (const opcao of opcoes) {
    nomes.push((await opcao.getText()).trim());
  }
  return nomes;
}

async function abrirRegistoResiduos(driver) {
  await driver.get(`${BASE_URL}/residuos`);
  await driver.wait(
    until.elementLocated(By.id("waste-filter-category")),
    20000,
  );
  await aguardarCarregamento(driver);
  await pausa(driver);
  console.log("Página de registo de resíduos aberta.");
}

async function confirmarTipoNaLista(driver) {
  const combobox = await abrirFiltroCategorias(driver);
  const opcoes = await lerOpcoesFiltroCategorias(driver);
  await fecharFiltroCategorias(driver, combobox);

  if (!opcoes.includes(NOME_TIPO)) {
    throw new Error(
      `«${NOME_TIPO}» não está nas opções do filtro. Opções: ${opcoes.join(", ")}`,
    );
  }

  console.log(`«${NOME_TIPO}» confirmado como opção na lista de tipos.`);
}

async function main() {
  const driver = await criarDriver();

  try {
    console.log(`=== RF12 («${NOME_TIPO}») ===`);
    await executarPasso(driver, 1, "Login como administrador", "login", () => fazerLogin(driver));
    await limparTipoTeste();
    await executarPasso(driver, 2, "Abrir categorias de resíduos", "categorias_abertas", () => abrirCategoriasResiduos(driver));
    await executarPasso(driver, 3, "Adicionar tipo «teste»", "tipo_adicionado", () => adicionarTipo(driver));
    await executarPasso(driver, 4, "Abrir registo de resíduos", "registo_aberto", () => abrirRegistoResiduos(driver));
    await executarPasso(driver, 5, "Confirmar tipo na lista de filtros", "tipo_na_lista", () => confirmarTipoNaLista(driver));

    console.log("=== RF12 ===");
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
    await limparTipoTeste();
    console.log(`Evidências em: evidencias/${TESTE_ID}/`);
    await pausa(driver, 2000);
    // await driver.quit();
  }
}

main().catch((erro) => {
  console.error("Erro ao executar o script:", erro);
  process.exit(1);
});
