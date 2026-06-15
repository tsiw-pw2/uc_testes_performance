/**
 * RF02: Definir perfis (Voluntário/Org/Admin) — consultar e alterar o cargo de utilizadores.
 *
 * Resultado esperado:
 * - Contas do seed exibem os perfis Voluntário, Organizador e Administrador.
 * - O administrador pode seleccionar qualquer um dos três cargos e guardar a alteração.
 * - O cargo actualizado fica visível no detalhe do utilizador.
 *
 * Pré-requisitos:
 * - API Mariva a correr (http://127.0.0.1:3000)
 * - Frontend a correr (http://localhost:5173)
 * - Base de dados com seed: pnpm run db:seed (password Demo2026!)
 *
 * Executar: node "tests/RF02.js"
 */

const { By, until } = require("selenium-webdriver");
const { criarDriver } = require("../criar-driver");

const BASE_URL = process.env.APP_URL || "http://localhost:5173";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@demo.pt";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Demo2026!";

const USER_ADMIN_ID =
  process.env.USER_ADMIN_ID || "10000000-0000-4000-8000-000000000001";
const USER_ORGANIZER_ID =
  process.env.USER_ORGANIZER_ID || "10000000-0000-4000-8000-000000000002";
const USER_VOLUNTEER_ID =
  process.env.USER_VOLUNTEER_ID || "10000000-0000-4000-8000-000000000006";

const PERFIS_DISPONIVEIS = ["Voluntário", "Organizador", "Administrador"];

const TESTE_ID = "RF02";
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

async function fazerLoginAdmin(driver) {
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
  await escreverLentamente(email, ADMIN_EMAIL);
  await pausa(driver, 600);
  await escreverLentamente(password, ADMIN_PASSWORD);
  await pausa(driver, 600);
  await entrar.click();

  await driver.wait(
    until.urlMatches(/\/(dashboard|campanhas|definicoes)/),
    20000,
  );
  await aguardarCarregamento(driver);
  await pausa(driver);
  console.log("Sessão de administrador iniciada.");
}

async function abrirDetalheUtilizador(driver, userId) {
  await driver.get(`${BASE_URL}/definicoes/utilizadores/${userId}/informacao`);
  await driver.wait(
    until.urlContains(`/utilizadores/${userId}`),
    20000,
  );
  await aguardarCarregamento(driver);
  await driver.wait(
    until.elementLocated(By.xpath("//h3[contains(@class,'font-semibold')]")),
    15000,
  );
  await pausa(driver);
}

async function lerPapelUtilizador(driver) {
  const papel = await driver.wait(
    until.elementLocated(
      By.xpath(
        "//h3[contains(@class,'font-semibold')]/following-sibling::div//span[contains(@class,'text-neutral-600')]",
      ),
    ),
    15000,
  );
  return (await papel.getText()).trim();
}

async function verificarPapelUtilizador(driver, papelEsperado) {
  const papel = await lerPapelUtilizador(driver);
  if (papel !== papelEsperado) {
    throw new Error(
      `Perfil devia ser «${papelEsperado}»; obtido: «${papel}».`,
    );
  }
  console.log(`Perfil confirmado: ${papel}.`);
}

async function abrirSeletorCargo(driver) {
  const trigger = await driver.wait(
    until.elementLocated(By.id("user-details-role")),
    15000,
  );
  await pausa(driver, 450);
  await trigger.click();
  await driver.wait(
    until.elementLocated(By.css('[role="listbox"]')),
    10000,
  );
  await pausa(driver, 300);
}

async function lerOpcoesCargo(driver) {
  const opcoes = await driver.findElements(
    By.xpath("//div[@role='option']//span | //div[@role='option']"),
  );
  const textos = [];
  for (const opcao of opcoes) {
    const texto = (await opcao.getText()).trim();
    if (texto) textos.push(texto);
  }
  return [...new Set(textos)];
}

async function verificarPerfisDisponiveis(driver) {
  await abrirSeletorCargo(driver);
  const opcoes = await lerOpcoesCargo(driver);

  for (const perfil of PERFIS_DISPONIVEIS) {
    if (!opcoes.includes(perfil)) {
      throw new Error(
        `O seletor de cargo devia incluir «${perfil}»; opções: ${opcoes.join(", ")}.`,
      );
    }
  }

  await driver.actions().sendKeys("\uE00C").perform();
  await pausa(driver, 400);
  console.log(`Perfis disponíveis: ${PERFIS_DISPONIVEIS.join(", ")}.`);
}

async function selecionarCargo(driver, papelLabel) {
  await abrirSeletorCargo(driver);
  const opcao = await driver.wait(
    until.elementLocated(
      By.xpath(
        `//div[@role='option'][.//span[normalize-space()=${JSON.stringify(papelLabel)}] or normalize-space()=${JSON.stringify(papelLabel)}]`,
      ),
    ),
    10000,
  );
  await opcao.click();
  await pausa(driver, 450);
  console.log(`Cargo seleccionado: ${papelLabel}.`);
}

async function guardarCargo(driver) {
  const guardar = await driver.wait(
    until.elementLocated(
      By.xpath("//button[normalize-space()='Guardar cargo']"),
    ),
    10000,
  );
  await guardar.click();
  await aguardarCarregamento(driver);
  await pausa(driver, 800);
  console.log("Cargo guardado.");
}

async function alterarCargoUtilizador(driver, papelLabel) {
  await selecionarCargo(driver, papelLabel);
  await guardarCargo(driver);
  await verificarPapelUtilizador(driver, papelLabel);
}

async function main() {
  const driver = await criarDriver();

  try {
    console.log("=== RF02 ===");

    await executarPasso(
      driver,
      1,
      "Login como administrador",
      "login_admin",
      () => fazerLoginAdmin(driver),
    );
    await executarPasso(
      driver,
      2,
      "Confirmar perfil Administrador",
      "perfil_admin",
      async () => {
        await abrirDetalheUtilizador(driver, USER_ADMIN_ID);
        await verificarPapelUtilizador(driver, "Administrador");
      },
    );
    await executarPasso(
      driver,
      3,
      "Confirmar perfil Organizador",
      "perfil_organizador",
      async () => {
        await abrirDetalheUtilizador(driver, USER_ORGANIZER_ID);
        await verificarPapelUtilizador(driver, "Organizador");
      },
    );
    await executarPasso(
      driver,
      4,
      "Confirmar perfil Voluntário",
      "perfil_voluntario",
      async () => {
        await abrirDetalheUtilizador(driver, USER_VOLUNTEER_ID);
        await verificarPapelUtilizador(driver, "Voluntário");
      },
    );
    await executarPasso(
      driver,
      5,
      "Verificar opções Voluntário/Organizador/Administrador",
      "opcoes_perfis",
      () => verificarPerfisDisponiveis(driver),
    );
    await executarPasso(
      driver,
      6,
      "Alterar voluntário para Organizador",
      "alterar_para_organizador",
      () => alterarCargoUtilizador(driver, "Organizador"),
    );
    await executarPasso(
      driver,
      7,
      "Restaurar voluntário para Voluntário",
      "restaurar_voluntario",
      () => alterarCargoUtilizador(driver, "Voluntário"),
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
