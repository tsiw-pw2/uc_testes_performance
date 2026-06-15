/**
 * RF1: Autenticar utilizadores — login, rejeição de credenciais inválidas e terminar sessão.
 *
 * Resultado esperado:
 * - A página /entrar apresenta o formulário de autenticação.
 * - Credenciais inválidas mantêm o utilizador em /entrar com mensagem de erro.
 * - Credenciais válidas (admin e voluntário) iniciam sessão e redirecionam para a app.
 * - Terminar sessão devolve o utilizador à página inicial (/).
 * - Rotas protegidas redirecionam para /entrar sem sessão activa.
 *
 * Pré-requisitos:
 * - API Mariva a correr (http://127.0.0.1:3000)
 * - Frontend a correr (http://localhost:5173)
 * - Base de dados com seed: pnpm run db:seed (password Demo2026!)
 * - Credenciais no .env (ou valores por defeito do seed)
 *
 * Executar: node "tests/RF01.js"
 */

const { By, until } = require("selenium-webdriver");
const { criarDriver } = require("../criar-driver");

const BASE_URL = process.env.APP_URL || "http://localhost:5173";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@demo.pt";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Demo2026!";

const VOLUNTARIO_EMAIL =
  process.env.VOLUNTARIO_EMAIL || "voluntario1@demo.pt";
const VOLUNTARIO_PASSWORD =
  process.env.VOLUNTARIO_PASSWORD || "Demo2026!";

const TESTE_ID = "RF01";
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
  await driver.manage().deleteAllCookies();
  await driver.get(`${BASE_URL}/entrar`);
  await driver.manage().window().maximize();

  await driver.wait(until.elementLocated(By.id("login-email")), 15000);
  await driver.wait(until.elementLocated(By.id("login-password")), 15000);
  await driver.wait(
    until.elementLocated(
      By.xpath("//button[@type='submit' and contains(., 'Entrar')]"),
    ),
    15000,
  );
  await pausa(driver);
  console.log("Página de login disponível.");
}

async function submeterLogin(driver, email, password) {
  const campoEmail = await driver.findElement(By.id("login-email"));
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
}

async function verificarErroCredenciaisInvalidas(driver) {
  await pausa(driver, 1200);

  const url = await driver.getCurrentUrl();
  if (!url.includes("/entrar")) {
    throw new Error(
      `Credenciais inválidas não deviam autenticar; URL actual: ${url}`,
    );
  }

  const mensagensErro = await driver.findElements(
    By.xpath(
      "//*[@role='alert' or contains(@class,'text-red') or contains(@class,'text-destructive')][normalize-space()!=''] | //*[contains(normalize-space(),'incorrect') or contains(normalize-space(),'incorret') or contains(normalize-space(),'inválid') or contains(normalize-space(),'Credenciais') or contains(normalize-space(),'palavra-passe') or contains(normalize-space(),'password')]",
    ),
  );

  if (mensagensErro.length === 0) {
    throw new Error(
      "Nenhuma mensagem de erro visível após submissão de credenciais inválidas.",
    );
  }

  console.log("Credenciais inválidas rejeitadas com mensagem de erro.");
}

async function tentarLoginInvalido(driver) {
  await submeterLogin(driver, ADMIN_EMAIL, "PasswordErrada123!");
  await verificarErroCredenciaisInvalidas(driver);
}

async function verificarSessaoAtiva(driver, email) {
  await driver.wait(
    until.urlMatches(/\/(dashboard|campanhas|definicoes|praias)/),
    20000,
  );
  await aguardarCarregamento(driver);
  await pausa(driver);

  const url = await driver.getCurrentUrl();
  if (url.includes("/entrar")) {
    throw new Error(`Sessão não iniciada para ${email}; URL: ${url}`);
  }

  const menuConta = await driver.findElements(
    By.xpath("//button[@aria-haspopup='menu']"),
  );
  if (menuConta.length === 0) {
    throw new Error(
      `Menu da conta não encontrado após login de ${email}.`,
    );
  }

  console.log(`Sessão iniciada com sucesso: ${email}`);
}

async function autenticarUtilizador(driver, email, password) {
  await abrirPaginaLogin(driver);
  await submeterLogin(driver, email, password);
  await verificarSessaoAtiva(driver, email);
}

async function terminarSessao(driver) {
  const menuConta = await driver.wait(
    until.elementLocated(
      By.xpath(
        "//button[@aria-haspopup='menu']//span[normalize-space()='Abrir menu da conta']/ancestor::button | //button[@aria-haspopup='menu']",
      ),
    ),
    10000,
  );
  await pausa(driver, 450);
  await menuConta.click();

  const terminar = await driver.wait(
    until.elementLocated(
      By.xpath(
        "//button[normalize-space()='Terminar sessão' or contains(normalize-space(),'Terminar sessão')]",
      ),
    ),
    10000,
  );
  await pausa(driver, 400);
  await terminar.click();
  await pausa(driver, 1200);

  await driver.wait(async () => {
    const url = await driver.getCurrentUrl();
    const path = new URL(url).pathname;
    return path === "/" || path === "";
  }, 15000);

  const menuContaAposLogout = await driver.findElements(
    By.xpath("//button[@aria-haspopup='menu']"),
  );
  if (menuContaAposLogout.length > 0) {
    throw new Error("Menu da conta ainda visível após terminar sessão.");
  }

  await driver.wait(
    until.elementLocated(
      By.xpath(
        "//*[contains(normalize-space(),'Organize e participe') or (self::a or self::button) and contains(normalize-space(),'Entrar')]",
      ),
    ),
    10000,
  );
  console.log("Sessão terminada; página inicial restaurada.");
}

async function verificarRotaProtegidaSemSessao(driver) {
  await driver.manage().deleteAllCookies();
  await driver.get(`${BASE_URL}/dashboard`);

  await driver.wait(until.urlContains("/entrar"), 15000);
  await driver.wait(until.elementLocated(By.id("login-email")), 15000);
  console.log("Rota protegida redireccionou para login sem sessão activa.");
}

async function main() {
  const driver = await criarDriver();

  try {
    console.log("=== RF01 ===");

    await executarPasso(
      driver,
      1,
      "Abrir página de login",
      "pagina_login",
      () => abrirPaginaLogin(driver),
    );
    await executarPasso(
      driver,
      2,
      "Rejeitar credenciais inválidas",
      "credenciais_invalidas",
      () => tentarLoginInvalido(driver),
    );
    await executarPasso(
      driver,
      3,
      "Autenticar administrador",
      "login_admin",
      () => autenticarUtilizador(driver, ADMIN_EMAIL, ADMIN_PASSWORD),
    );
    await executarPasso(
      driver,
      4,
      "Terminar sessão do administrador",
      "logout_admin",
      () => terminarSessao(driver),
    );
    await executarPasso(
      driver,
      5,
      "Autenticar voluntário",
      "login_voluntario",
      () => autenticarUtilizador(driver, VOLUNTARIO_EMAIL, VOLUNTARIO_PASSWORD),
    );
    await executarPasso(
      driver,
      6,
      "Terminar sessão do voluntário",
      "logout_voluntario",
      () => terminarSessao(driver),
    );
    await executarPasso(
      driver,
      7,
      "Redirecionar rota protegida sem sessão",
      "rota_protegida",
      () => verificarRotaProtegidaSemSessao(driver),
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
