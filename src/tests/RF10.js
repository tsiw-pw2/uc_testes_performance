/**
 * RF10: Indicar tipo de resíduo — filtrar relatório por categorias Plástico e Vidro.
 *
 * Resultado esperado: o sistema separa o lixo por categorias no relatório (tabela filtrada).
 *
 * Pré-requisitos:
 * - API Mariva a correr (http://127.0.0.1:3000)
 * - Frontend a correr (http://localhost:5173)
 * - Base de dados com seed: pnpm run db:seed (password Demo2026!)
 *
 * Executar: node "tests/RF10.js"
 */

const fs = require("fs");
const path = require("path");
const { By, until } = require("selenium-webdriver");
const { criarDriver } = require("../criar-driver");

const BASE_URL = process.env.APP_URL || "http://localhost:5173";
const EMAIL = process.env.TEST_EMAIL || "admin@demo.pt";
const PASSWORD = process.env.TEST_PASSWORD || "Demo2026!";

/** Nomes exactos das categorias no seed */
const CATEGORIA_PLASTICOS = process.env.CATEGORIA_PLASTICO || "Plástico";
const CATEGORIA_VIDRO = process.env.CATEGORIA_VIDRO || "Vidro";

const EVIDENCIAS_DIR = path.join(__dirname, "..", "..", "evidencias");
const TESTE_ID = "RF10";
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
    until.urlMatches(/\/(dashboard|campanhas|residuos)/),
    20000,
  );
  await pausa(driver);
  console.log("Sessão iniciada com sucesso.");
}

async function abrirRegistoResiduos(driver) {
  await driver.get(`${BASE_URL}/residuos`);

  await driver.wait(
    until.elementLocated(By.id("waste-filter-category")),
    20000,
  );

  await driver.wait(async () => {
    const loading = await driver.findElements(
      By.xpath("//*[contains(normalize-space(),'A carregar')]"),
    );
    return loading.length === 0;
  }, 20000);

  await pausa(driver);
  console.log("Página de registo de resíduos aberta.");
}

async function aguardarCarregamentoLista(driver) {
  await driver.wait(async () => {
    const loading = await driver.findElements(
      By.xpath("//*[contains(normalize-space(),'A carregar')]"),
    );
    return loading.length === 0;
  }, 20000);
}

async function textoFiltroCategorias(driver) {
  const filtro = await driver.findElement(By.id("waste-filter-category"));
  const combobox = await filtro.findElement(By.css('[role="combobox"]'));
  return (await combobox.getText()).trim();
}

async function alternarOpcaoListbox(driver, nomeCategoria) {
  const listbox = await driver.wait(
    until.elementLocated(
      By.css('div[role="listbox"][aria-multiselectable="true"]'),
    ),
    10000,
  );

  const opcao = await listbox.findElement(
    By.xpath(
      `.//div[@role='option'][.//span[normalize-space()=${JSON.stringify(nomeCategoria)}]]`,
    ),
  );

  await driver.executeScript(
    'arguments[0].scrollIntoView({ block: "nearest" });',
    opcao,
  );

  const seleccionada = await opcao.getAttribute("aria-selected");
  if (seleccionada !== "true") {
    await driver.executeScript(
      `arguments[0].dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window })
      );`,
      opcao,
    );
  }

  await pausa(driver, 300);
}

async function abrirFiltroCategorias(driver) {
  const filtro = await driver.findElement(By.id("waste-filter-category"));
  const combobox = await filtro.findElement(By.css('[role="combobox"]'));
  await combobox.click();
  await pausa(driver, 400);
  return combobox;
}

async function fecharFiltroCategorias(driver, combobox) {
  await combobox.click();
  await pausa(driver, 300);
}


async function abrirFiltroComCategoriasSeleccionadas(driver) {
  await aguardarCarregamentoLista(driver);
  await abrirFiltroCategorias(driver);
  await alternarOpcaoListbox(driver, CATEGORIA_PLASTICOS);
  await alternarOpcaoListbox(driver, CATEGORIA_VIDRO);
  await pausa(driver, 500);

  await driver.wait(
    until.elementLocated(
      By.css('div[role="listbox"][aria-multiselectable="true"]'),
    ),
    10000,
  );
  console.log(
    `Dropdown aberto com ${CATEGORIA_PLASTICOS} e ${CATEGORIA_VIDRO} seleccionados.`,
  );
}

async function fecharFiltroEVerificar(driver) {
  const filtro = await driver.findElement(By.id("waste-filter-category"));
  const combobox = await filtro.findElement(By.css('[role="combobox"]'));
  await fecharFiltroCategorias(driver, combobox);
  await aguardarCarregamentoLista(driver);

  const rotulo = await textoFiltroCategorias(driver);
  if (!rotulo.includes("2")) {
    throw new Error(
      `Filtro devia mostrar 2 categorias (ex.: «2 estados»); obtido: «${rotulo}».`,
    );
  }

  const url = await driver.getCurrentUrl();
  const paramsCategoria = (url.match(/category=/g) || []).length;
  if (paramsCategoria < 2) {
    throw new Error(
      `URL devia ter 2 parâmetros category=; encontrados: ${paramsCategoria}.`,
    );
  }

  console.log(`Filtro aplicado: ${CATEGORIA_PLASTICOS} e ${CATEGORIA_VIDRO} (${rotulo}).`);
}

function categoriaPermitida(nome) {
  const n = nome.trim();
  if (/plástic/i.test(n)) return true;
  if (/^vidro$/i.test(n)) return true;
  return false;
}

async function lerCategoriasPaginaAtual(driver) {
  const linhas = await driver.findElements(
    By.xpath("//table/tbody/tr[.//td]"),
  );

  const categoriasVistas = new Set();

  for (const linha of linhas) {
    const celulaCategoria = await linha.findElement(By.xpath(".//td[2]//span"));
    const categoria = (await celulaCategoria.getText()).trim();
    categoriasVistas.add(categoria);

    if (!categoriaPermitida(categoria)) {
      throw new Error(
        `Relatório inclui categoria não seleccionada: «${categoria}».`,
      );
    }

    const nomeResiduo = (
      await linha.findElement(By.xpath(".//td[1]")).getText()
    ).trim();
    console.log(`  ${nomeResiduo} → ${categoria}`);
  }

  return categoriasVistas;
}

async function verificarRelatorioPorCategorias(driver) {
  await aguardarCarregamentoLista(driver);

  const categoriasVistas = new Set();
  let temPlastico = false;
  let temVidro = false;
  let pagina = 1;

  do {
    await aguardarCarregamentoLista(driver);

    const linhas = await driver.findElements(
      By.xpath("//table/tbody/tr[.//td]"),
    );
    if (linhas.length === 0 && pagina === 1) {
      throw new Error("Relatório sem linhas após aplicar o filtro.");
    }

    console.log(`Página ${pagina} do relatório:`);
    for (const categoria of await lerCategoriasPaginaAtual(driver)) {
      categoriasVistas.add(categoria);
      if (/plástic/i.test(categoria)) temPlastico = true;
      if (/^vidro$/i.test(categoria)) temVidro = true;
    }

    if (temPlastico && temVidro) break;

    const botaoSeguinte = await driver.findElements(
      By.xpath("//button[normalize-space()='Seguinte' and not(@disabled)]"),
    );
    if (botaoSeguinte.length === 0) break;

    await botaoSeguinte[0].click();
    pagina += 1;
    await pausa(driver, 600);
  } while (pagina <= 10);

  if (!temPlastico || !temVidro) {
    throw new Error(
      `Relatório deve incluir ${CATEGORIA_PLASTICOS} e ${CATEGORIA_VIDRO}; visto: ${[...categoriasVistas].join(", ")}.`,
    );
  }

  console.log(
    `Relatório separado por categorias: ${[...categoriasVistas].join(" · ")} (${pagina} página(s) verificada(s)).`,
  );
}

async function main() {
  const driver = await criarDriver();

  try {
    console.log("=== RF10 ===");
    await executarPasso(driver, 1, "Login como administrador", "login", () => fazerLogin(driver));
    await executarPasso(driver, 2, "Abrir registo de resíduos", "registo_residuos", () => abrirRegistoResiduos(driver));
    await executarPasso(
      driver,
      3,
      "Dropdown de categorias aberto com Plástico e Vidro",
      "dropdown_filtros_aberto",
      () => abrirFiltroComCategoriasSeleccionadas(driver),
    );
    await executarPasso(
      driver,
      4,
      "Filtro aplicado ao relatório",
      "filtro_aplicado",
      () => fecharFiltroEVerificar(driver),
    );
    await executarPasso(
      driver,
      5,
      "Verificar relatório por categorias",
      "relatorio_verificado",
      () => verificarRelatorioPorCategorias(driver),
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
