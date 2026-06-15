/**
 * RF19: Dashboard de Informação — visualizar painel com informação importante.
 *
 * Resultado esperado:
 * - Widgets Campanhas, Praias e Utilizadores com valores numéricos.
 * - Painéis «Estatísticas de limpeza» e «Próxima Campanha» com dados visíveis.
 *
 * Pré-requisitos:
 * - API Mariva a correr (http://127.0.0.1:3000)
 * - Frontend a correr (http://localhost:5173)
 * - Base de dados com seed: pnpm run db:seed (password Demo2026!)
 *
 * Executar: node "src/tests/RF19.js"
 */

const { By, until } = require("selenium-webdriver");
const { criarDriver } = require("../criar-driver");
const SEED = require("../test-seed");

const BASE_URL = process.env.APP_URL || "http://localhost:5173";
const EMAIL = process.env.TEST_EMAIL || SEED.EMAIL;
const PASSWORD = process.env.TEST_PASSWORD || SEED.PASSWORD;

const TESTE_ID = "RF19";
const { createEvidencias } = require("../tc-evidencias");
const { executarPasso, screenshotErro } = createEvidencias(TESTE_ID);
const DELAY_ENTRE_PASSOS_MS = Number(process.env.TEST_DELAY_MS) || 1200;
const DELAY_DIGITACAO_MS = Number(process.env.TEST_TYPING_MS) || 50;

const WIDGETS_METRICA = ["Campanhas", "Praias", "Utilizadores"];
const ETIQUETAS_LIMPEZA = [
  "Campanhas concluídas",
  "Kg pesados",
  "Resíduos apanhados",
  "Resíduo mais comum",
];
const ETIQUETAS_PROXIMA_CAMPANHA = ["Título", "Data", "Inscritos", "Praias"];

function painelDoTitulo(titulo) {
  return By.xpath(
    `//p[normalize-space()='${titulo}']/ancestor::div[contains(@class,'rounded-lg') and contains(@class,'bg-white')][1]`,
  );
}

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

async function aguardarCarregamentoDashboard(driver) {
  await driver.wait(async () => {
    const loading = await driver.findElements(
      By.xpath("//*[normalize-space()='A carregar…']"),
    );
    return loading.length === 0;
  }, 20000);

  const erros = await driver.findElements(
    By.xpath(
      "//*[contains(normalize-space(), 'Não foi possível carregar o painel')]",
    ),
  );
  if (erros.length > 0) {
    throw new Error("O Dashboard apresentou erro ao carregar os dados.");
  }
}

async function acederDashboard(driver) {
  const urlAtual = await driver.getCurrentUrl();
  if (!urlAtual.includes("/dashboard")) {
    const linkDashboard = await driver.wait(
      until.elementLocated(
        By.xpath(
          "//a[normalize-space()='Dashboard' or contains(@href,'/dashboard')]",
        ),
      ),
      10000,
    );
    await pausa(driver, 600);
    await linkDashboard.click();
    await driver.wait(until.urlContains("/dashboard"), 15000);
  }

  await aguardarCarregamentoDashboard(driver);
  await pausa(driver);
  console.log("Dashboard aberto.");
}

async function verificarWidgetMetrica(driver, titulo) {
  const painel = await driver.wait(
    until.elementLocated(painelDoTitulo(titulo)),
    15000,
  );
  await driver.wait(until.elementIsVisible(painel), 5000);

  const valor = await painel.findElement(
    By.xpath(".//h6[contains(@class,'tabular-nums')]"),
  );
  const texto = (await valor.getText()).trim();

  if (!/^\d+$/.test(texto)) {
    throw new Error(
      `Widget «${titulo}»: esperado valor numérico, obtido «${texto}».`,
    );
  }

  console.log(`Widget «${titulo}» carregado com valor ${texto}.`);
}

async function verificarPainelKeyValue(driver, tituloPainel, etiquetasEsperadas) {
  const painel = await driver.wait(
    until.elementLocated(painelDoTitulo(tituloPainel)),
    15000,
  );
  await driver.wait(until.elementIsVisible(painel), 5000);

  for (const etiqueta of etiquetasEsperadas) {
    const linha = await painel.findElement(
      By.xpath(`.//span[normalize-space()='${etiqueta}']`),
    );
    const valor = await linha.findElement(
      By.xpath("./following-sibling::*[1]"),
    );
    const textoValor = (await valor.getText()).trim();

    if (!textoValor) {
      throw new Error(
        `Painel «${tituloPainel}»: linha «${etiqueta}» sem valor.`,
      );
    }

    console.log(`  ${etiqueta}: ${textoValor}`);
  }

  console.log(`Painel «${tituloPainel}» carregado.`);
}

async function verificarWidgetsDashboard(driver) {
  for (const titulo of WIDGETS_METRICA) {
    await verificarWidgetMetrica(driver, titulo);
    await pausa(driver, 450);
  }

  await verificarPainelKeyValue(
    driver,
    "Estatísticas de limpeza",
    ETIQUETAS_LIMPEZA,
  );
  await pausa(driver, 450);

  await verificarPainelKeyValue(
    driver,
    "Próxima Campanha",
    ETIQUETAS_PROXIMA_CAMPANHA,
  );

  console.log("Todos os widgets do dashboard foram verificados.");
}

async function main() {
  const driver = await criarDriver();

  try {
    console.log("=== RF19 ===");
    await executarPasso(driver, 1, "Login como administrador", "login", () => fazerLogin(driver));
    await executarPasso(driver, 2, "Aceder ao Dashboard", "dashboard_aberto", () => acederDashboard(driver));
    await executarPasso(driver, 3, "Verificar widgets do dashboard", "widgets_ok", () => verificarWidgetsDashboard(driver));

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
  }
}

main().catch((erro) => {
  console.error("Erro ao executar o script:", erro);
  process.exit(1);
});
