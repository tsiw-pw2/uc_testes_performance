/**
 * RF13: Criar campanha — «Nova Campanha» e verificar na lista pública de limpezas.
 *
 * Resultado esperado:
 * - Clicar em «Nova Campanha» / «Criar Campanha», preencher dados e submeter.
 * - A campanha criada aparece na lista de campanhas (/campanhas).
 *
 * Pré-requisitos:
 * - API Mariva a correr (http://127.0.0.1:3000)
 * - Frontend a correr (http://localhost:5173)
 * - Base de dados com seed: pnpm run db:seed (password Demo2026!)
 *
 * Executar: node "src/tests/RF13.js"
 */

const { By, until } = require("selenium-webdriver");
const { criarDriver } = require("../criar-driver");

const BASE_URL = process.env.APP_URL || "http://localhost:5173";
const EMAIL = process.env.TEST_EMAIL || "admin@demo.pt";
const PASSWORD = process.env.TEST_PASSWORD || "Demo2026!";

const TITULO_CAMPANHA =
  process.env.CAMPAIGN_TITLE ||
  `Limpeza teste Selenium ${Date.now()}`;
const DISTRITO_LABEL = process.env.CAMPAIGN_DISTRICT || "Porto";
const ESTADO_LABEL =
  process.env.CAMPAIGN_STATUS_LABEL || "Aberta a inscrições";
const HORA_ENCONTRO = process.env.CAMPAIGN_MEETING_TIME || "09:30";
const INFORMACOES =
  process.env.CAMPAIGN_DESCRIPTION ||
  "Campanha criada automaticamente pelo teste Selenium.";

const TESTE_ID = "RF13";
const { createEvidencias } = require("../tc-evidencias");
const { executarPasso, screenshotErro } = createEvidencias(TESTE_ID);
const DELAY_ENTRE_PASSOS_MS = Number(process.env.TEST_DELAY_MS) || 1200;
const DELAY_DIGITACAO_MS = Number(process.env.TEST_TYPING_MS) || 50;

const ANO_CAMPANHA = Number(process.env.CAMPAIGN_YEAR) || 2026;

function formatarDataIso(ano, mes, dia) {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function dataDaquiADiasEm2026(dias) {
  const base = new Date(ANO_CAMPANHA, 4, 29);
  base.setDate(base.getDate() + dias);
  if (base.getFullYear() !== ANO_CAMPANHA) {
    throw new Error(
      `A data calculada saiu do ano ${ANO_CAMPANHA}: ${base.toISOString()}`,
    );
  }
  return formatarDataIso(
    ANO_CAMPANHA,
    base.getMonth() + 1,
    base.getDate(),
  );
}

const DATA_INICIO =
  process.env.CAMPAIGN_START_DATE || dataDaquiADiasEm2026(14);
const DATA_FIM =
  process.env.CAMPAIGN_END_DATE || dataDaquiADiasEm2026(14);

function xpathModalCriarCampanha() {
  return "//div[@role='dialog'][.//*[@id='create-campaign-modal-title']]";
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
      `Data devia ser ${valorIso} (ano ${ANO_CAMPANHA}); o campo ficou com «${valorGravado}».`,
    );
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

async function abrirListaCampanhas(driver) {
  const urlAtual = await driver.getCurrentUrl();
  if (!urlAtual.includes("/campanhas")) {
    const link = await driver.wait(
      until.elementLocated(
        By.xpath(
          "//a[normalize-space()='Campanhas' or contains(@href,'/campanhas')]",
        ),
      ),
      10000,
    );
    await pausa(driver, 600);
    await link.click();
    await driver.wait(until.urlContains("/campanhas"), 15000);
  } else {
    await driver.get(`${BASE_URL}/campanhas`);
  }

  await driver.wait(
    until.elementLocated(By.css("table.campaign-list-table, h2")),
    20000,
  );
  await aguardarCarregamento(driver);
  await pausa(driver);
  console.log("Lista pública de campanhas (limpezas) aberta.");
}

async function escolherOpcaoCombobox(driver, rotuloCampo, textoOpcao) {
  const modal = await driver.findElement(By.xpath(xpathModalCriarCampanha()));
  const bloco = await modal.findElement(
    By.xpath(
      `.//*[self::label or self::p][contains(normalize-space(), ${JSON.stringify(rotuloCampo)})]/ancestor::div[contains(@class,'flex-col')][1]`,
    ),
  );
  const combobox = await bloco.findElement(By.css('[role="combobox"]'));
  await combobox.click();
  await pausa(driver, 400);

  const opcao = await driver.wait(
    until.elementLocated(
      By.xpath(
        `//div[@role='listbox']//div[@role='option'][.//span[normalize-space()=${JSON.stringify(textoOpcao)}] or normalize-space()=${JSON.stringify(textoOpcao)}]`,
      ),
    ),
    10000,
  );
  await opcao.click();
  await pausa(driver, 450);
}

async function clicarNovaCampanha(driver) {
  const botao = await driver.wait(
    until.elementLocated(
      By.xpath(
        "//button[contains(normalize-space(),'Criar Campanha') or contains(normalize-space(),'Nova Campanha') or contains(normalize-space(),'Nova campanha')]",
      ),
    ),
    10000,
  );
  await pausa(driver, 600);
  await botao.click();

  await driver.wait(
    until.elementLocated(By.id("create-campaign-modal-title")),
    10000,
  );
  await pausa(driver);
  console.log("Modal de criação de campanha aberto.");
}

async function preencherPassoDetalhes(driver) {
  const titulo = await driver.findElement(By.id("create-campaign-title"));
  const hora = await driver.findElement(By.id("create-campaign-meeting-time"));
  const dataInicio = await driver.findElement(By.id("create-campaign-start-date"));
  const dataFim = await driver.findElement(By.id("create-campaign-end-date"));
  const informacoes = await driver.findElement(
    By.id("create-campaign-information"),
  );

  await pausa(driver);
  await escreverLentamente(titulo, TITULO_CAMPANHA);
  await pausa(driver, 450);
  await escolherOpcaoCombobox(driver, "Distrito", DISTRITO_LABEL);
  await hora.clear();
  await hora.sendKeys(HORA_ENCONTRO);
  await pausa(driver, 300);
  await preencherCampoData(driver, dataInicio, DATA_INICIO);
  await pausa(driver, 300);
  await preencherCampoData(driver, dataFim, DATA_FIM);
  await pausa(driver, 300);
  console.log(`Datas da campanha: ${DATA_INICIO} — ${DATA_FIM} (ano ${ANO_CAMPANHA})`);
  await escolherOpcaoCombobox(driver, "Estado", ESTADO_LABEL);
  await pausa(driver, 300);
  await escreverLentamente(informacoes, INFORMACOES);

  const proximo = await driver.findElement(
    By.xpath(
      `${xpathModalCriarCampanha()}//button[@type='submit' and normalize-space()='Próximo']`,
    ),
  );
  await pausa(driver, 600);
  await proximo.click();

  await driver.wait(
    until.elementLocated(
      By.xpath(`${xpathModalCriarCampanha()}//input[@type='checkbox']`),
    ),
    15000,
  );
  await pausa(driver);
  console.log("Passo 1 (detalhes) preenchido; passo 2 (praias) aberto.");
}

async function preencherPassoPraiasECriar(driver) {
  const modal = await driver.findElement(By.xpath(xpathModalCriarCampanha()));
  const checkboxes = await modal.findElements(By.css("input[type='checkbox']"));
  if (checkboxes.length === 0) {
    throw new Error(
      "Não há praias disponíveis no distrito escolhido. Verifica o seed ou escolhe outro distrito.",
    );
  }

  const primeira = checkboxes[0];
  if (!(await primeira.isSelected())) {
    await primeira.click();
  }
  await pausa(driver, 450);

  const criar = await driver.findElement(
    By.xpath(
      `${xpathModalCriarCampanha()}//button[@type='submit' and (normalize-space()='Criar campanha' or normalize-space()='Criar Campanha')]`,
    ),
  );
  await criar.click();

  await driver.wait(async () => {
    const modais = await driver.findElements(
      By.id("create-campaign-modal-title"),
    );
    return modais.length === 0;
  }, 20000);

  await aguardarCarregamento(driver);
  await pausa(driver);
  console.log("Campanha submetida com sucesso.");
}

async function pesquisarCampanhaNaLista(driver) {
  const pesquisa = await driver.wait(
    until.elementLocated(By.id("campaigns-filter-search")),
    10000,
  );
  await pausa(driver, 400);
  await escreverLentamente(pesquisa, TITULO_CAMPANHA);
  await pausa(driver, 900);
  await aguardarCarregamento(driver);
}

async function verificarCampanhaNaLista(driver) {
  await pesquisarCampanhaNaLista(driver);

  const linha = await driver.wait(
    until.elementLocated(
      By.xpath(
        `//table[contains(@class,'campaign-list-table')]//span[contains(@class,'campaign-list-title-cell__inner') and contains(normalize-space(), ${JSON.stringify(TITULO_CAMPANHA.slice(0, 24))})]`,
      ),
    ),
    20000,
  );

  const tituloVisivel = (await linha.getText()).trim();
  if (!tituloVisivel.includes(TITULO_CAMPANHA.slice(0, 20))) {
    throw new Error(
      `Campanha devia aparecer na lista; título visível: «${tituloVisivel}».`,
    );
  }

  console.log(`Campanha encontrada na lista: «${tituloVisivel}».`);
}

async function main() {
  const driver = await criarDriver();

  try {
    console.log("=== RF13 ===");
    await executarPasso(driver, 1, "Login como administrador", "login", () => fazerLogin(driver));
    await executarPasso(driver, 2, "Abrir lista de campanhas", "lista_campanhas", () => abrirListaCampanhas(driver));
    await executarPasso(driver, 3, "Clicar em Nova campanha", "nova_campanha", () => clicarNovaCampanha(driver));
    await executarPasso(driver, 4, "Preencher detalhes da campanha", "detalhes_preenchidos", () => preencherPassoDetalhes(driver));
    await executarPasso(driver, 5, "Seleccionar praias e criar campanha", "campanha_criada", () => preencherPassoPraiasECriar(driver));
    await executarPasso(driver, 6, "Confirmar campanha na lista pública", "campanha_na_lista", () => verificarCampanhaNaLista(driver));

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
