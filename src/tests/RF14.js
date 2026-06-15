/**
 * RF14: Editar campanhas — alterar horário de encontro de uma campanha.
 *
 * Resultado esperado: a alteração da hora de encontro é gravada com sucesso.
 *
 * Pré-requisitos:
 * - API Mariva a correr (http://127.0.0.1:3000)
 * - Frontend a correr (http://localhost:5173)
 * - Base de dados com seed: pnpm run db:seed (password Demo2026!)
 *
 * Executar: node "tests/RF14.js"
 */

const fs = require("fs");
const path = require("path");
const { By, until } = require("selenium-webdriver");
const { criarDriver } = require("../criar-driver");

const BASE_URL = process.env.APP_URL || "http://localhost:5173";
const API_URL = process.env.API_URL || "http://127.0.0.1:3000";
const EMAIL = process.env.TEST_EMAIL || "admin@demo.pt";
const PASSWORD = process.env.TEST_PASSWORD || "Demo2026!";

const PREFIXO_CAMPANHA =
  process.env.CAMPAIGN_TEST_PREFIX || "Campanha horário Selenium";
const TITULO_CAMPANHA =
  process.env.CAMPAIGN_TITLE || `${PREFIXO_CAMPANHA} ${Date.now()}`;
const DISTRITO_LABEL = process.env.CAMPAIGN_DISTRICT || "Porto";
const ESTADO_LABEL =
  process.env.CAMPAIGN_STATUS_LABEL || "Aberta a inscrições";
const HORA_ORIGINAL = process.env.CAMPAIGN_MEETING_TIME || "09:30";
const HORA_NOVA = process.env.CAMPAIGN_MEETING_TIME_NEW || "14:45";

const EVIDENCIAS_DIR = path.join(__dirname, "..", "..", "evidencias");
const TESTE_ID = "RF14";
const { createEvidencias } = require("../tc-evidencias");
const { executarPasso, screenshotErro } = createEvidencias(TESTE_ID);
const DELAY_ENTRE_PASSOS_MS = Number(process.env.TEST_DELAY_MS) || 1200;
const DELAY_DIGITACAO_MS = Number(process.env.TEST_TYPING_MS) || 50;
const ANO_CAMPANHA = Number(process.env.CAMPAIGN_YEAR) || 2026;

function dataDaquiADiasEm2026(dias) {
  const base = new Date(ANO_CAMPANHA, 4, 29);
  base.setDate(base.getDate() + dias);
  return `${ANO_CAMPANHA}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
}

const DATA_INICIO =
  process.env.CAMPAIGN_START_DATE || dataDaquiADiasEm2026(28);
const DATA_FIM = process.env.CAMPAIGN_END_DATE || dataDaquiADiasEm2026(28);

const TEXTOS_SUCESSO = [
  "campanha atualizada",
  "alterações foram guardadas",
  "alteracoes foram guardadas",
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

function xpathModalCriar() {
  return "//div[@role='dialog'][.//*[@id='create-campaign-modal-title']]";
}

function xpathModalEditar() {
  return "//div[@role='dialog'][.//*[@id='edit-campaign-title']]";
}

function xpathLinhaCampanha(titulo) {
  const fragmento = titulo.slice(0, 28);
  return `//table[contains(@class,'campaign-list-table')]//tr[.//span[contains(@class,'campaign-list-title-cell__inner') and contains(normalize-space(), ${JSON.stringify(fragmento)})]]`;
}

async function aguardarCarregamento(driver) {
  await driver.wait(async () => {
    const loading = await driver.findElements(
      By.xpath("//*[contains(normalize-space(),'A carregar')]"),
    );
    return loading.length === 0;
  }, 20000);
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

async function limparCampanhasTeste() {
  try {
    const token = await apiLogin();
    const res = await fetch(`${API_URL}/campaigns?page=1&pageSize=100`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return;
    const body = await res.json();
    const campanhas = body.data ?? body.items ?? [];
    for (const c of campanhas.filter((x) => x.title?.startsWith(PREFIXO_CAMPANHA))) {
      await fetch(`${API_URL}/campaigns/${c.id}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
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

  await driver.wait(until.urlMatches(/\/(dashboard|campanhas)/), 20000);
  await pausa(driver);
  console.log("Sessão iniciada com sucesso.");
}

async function abrirListaCampanhas(driver) {
  await driver.get(`${BASE_URL}/campanhas`);
  await driver.wait(
    until.elementLocated(
      By.css("table.campaign-list-table, #campaigns-filter-search"),
    ),
    20000,
  );
  await aguardarCarregamento(driver);
  await pausa(driver);
}

async function escolherOpcaoCombobox(modalXpath, driver, rotuloCampo, textoOpcao) {
  const modal = await driver.findElement(By.xpath(modalXpath));
  const bloco = await modal.findElement(
    By.xpath(
      `.//*[self::label or self::p][contains(normalize-space(), ${JSON.stringify(rotuloCampo)})]/ancestor::div[contains(@class,'flex-col')][1]`,
    ),
  );
  const combobox = await bloco.findElement(By.css('[role="combobox"]'));
  await combobox.click();
  await pausa(driver, 400);

  const listbox = await driver.wait(
    until.elementLocated(By.css('[role="listbox"]')),
    10000,
  );
  const opcao = await listbox.findElement(
    By.xpath(
      `.//*[@role='option'][.//span[normalize-space()=${JSON.stringify(textoOpcao)}] or normalize-space()=${JSON.stringify(textoOpcao)}]`,
    ),
  );
  await opcao.click();
  await pausa(driver, 450);
}

async function preencherCampoData(elemento, valorIso) {
  await elemento.getDriver().executeScript(
    `
    const el = arguments[0];
    el.value = arguments[1];
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    `,
    elemento,
    valorIso,
  );
}

async function pesquisarCampanha(driver, titulo) {
  const pesquisa = await driver.wait(
    until.elementLocated(By.id("campaigns-filter-search")),
    10000,
  );
  await pesquisa.clear();
  await pausa(driver, 300);
  await escreverLentamente(pesquisa, titulo);
  await pausa(driver, 900);
  await aguardarCarregamento(driver);
}

async function criarCampanhaTeste(driver) {
  const botao = await driver.wait(
    until.elementLocated(
      By.xpath("//button[contains(normalize-space(),'Criar Campanha')]"),
    ),
    10000,
  );
  await botao.click();
  await driver.wait(
    until.elementLocated(By.id("create-campaign-modal-title")),
    10000,
  );
  await pausa(driver);

  await escreverLentamente(
    await driver.findElement(By.id("create-campaign-title")),
    TITULO_CAMPANHA,
  );
  await escolherOpcaoCombobox(xpathModalCriar(), driver, "Distrito", DISTRITO_LABEL);

  const hora = await driver.findElement(By.id("create-campaign-meeting-time"));
  await hora.clear();
  await hora.sendKeys(HORA_ORIGINAL);

  await preencherCampoData(
    await driver.findElement(By.id("create-campaign-start-date")),
    DATA_INICIO,
  );
  await preencherCampoData(
    await driver.findElement(By.id("create-campaign-end-date")),
    DATA_FIM,
  );
  await escolherOpcaoCombobox(xpathModalCriar(), driver, "Estado", ESTADO_LABEL);

  const proximo = await driver.findElement(
    By.xpath(
      `${xpathModalCriar()}//button[@type='submit' and normalize-space()='Próximo']`,
    ),
  );
  await driver.wait(async () => await proximo.isEnabled(), 15000);
  await proximo.click();

  await driver.wait(
    until.elementLocated(
      By.xpath(`${xpathModalCriar()}//input[@type='checkbox']`),
    ),
    15000,
  );

  const modal = await driver.findElement(By.xpath(xpathModalCriar()));
  const checkbox = await modal.findElement(By.css("input[type='checkbox']"));
  if (!(await checkbox.isSelected())) {
    await checkbox.click();
  }

  await modal
    .findElement(
      By.xpath(
        ".//button[@type='submit' and (normalize-space()='Criar campanha' or normalize-space()='Criar Campanha')]",
      ),
    )
    .click();

  await driver.wait(async () => {
    const modais = await driver.findElements(
      By.id("create-campaign-modal-title"),
    );
    return modais.length === 0;
  }, 20000);

  await aguardarCarregamento(driver);
  console.log(`Campanha criada com horário ${HORA_ORIGINAL}.`);
}

async function abrirEdicaoCampanha(driver) {
  await pesquisarCampanha(driver, TITULO_CAMPANHA);
  const linha = await driver.wait(
    until.elementLocated(By.xpath(xpathLinhaCampanha(TITULO_CAMPANHA))),
    15000,
  );

  const editar = await linha.findElement(
    By.css("button[aria-label='Editar']"),
  );
  await pausa(driver, 450);
  await editar.click();

  await driver.wait(
    until.elementLocated(By.id("edit-campaign-title")),
    10000,
  );

  await driver.wait(async () => {
    const loading = await driver.findElements(
      By.xpath("//*[contains(normalize-space(),'A carregar dados da campanha')]"),
    );
    return loading.length === 0;
  }, 20000);

  const hora = await driver.wait(
    until.elementLocated(By.id("edit-campaign-meeting-time")),
    15000,
  );
  await driver.wait(async () => {
    const valor = await hora.getAttribute("value");
    return valor && valor.length > 0;
  }, 15000);

  await pausa(driver, 450);
  console.log("Modal «Editar campanha» aberto.");
  return hora;
}

async function preencherHorario(elemento, hora) {
  await elemento.clear();
  await elemento.getDriver().sleep(300);
  await elemento.sendKeys(hora);
}

async function alterarHorarioCampanha(driver) {
  const hora = await abrirEdicaoCampanha(driver);
  const valorAntes = (await hora.getAttribute("value")) || "";
  console.log(`Horário actual no formulário: ${valorAntes}`);

  await preencherHorario(hora, HORA_NOVA);
  await pausa(driver, 400);

  const modal = await driver.findElement(By.xpath(xpathModalEditar()));
  const proximo = await modal.findElement(
    By.xpath(".//button[@type='submit' and normalize-space()='Próximo']"),
  );
  await driver.wait(async () => await proximo.isEnabled(), 15000);
  await proximo.click();
  await pausa(driver, 600);

  await driver.wait(
    until.elementLocated(
      By.xpath(`${xpathModalEditar()}//input[@type='checkbox']`),
    ),
    15000,
  );

  const guardar = await driver.findElement(
    By.xpath(
      `${xpathModalEditar()}//button[@type='submit' and normalize-space()='Guardar']`,
    ),
  );
  await driver.wait(async () => await guardar.isEnabled(), 15000);
  await guardar.click();

  await driver.wait(async () => {
    const modais = await driver.findElements(By.id("edit-campaign-title"));
    return modais.length === 0;
  }, 20000);

  await aguardarMensagemGuardada(driver);
  console.log(`Horário alterado para ${HORA_NOVA}.`);
}

async function aguardarMensagemGuardada(driver) {
  const alvo = TEXTOS_SUCESSO.map(normalizarTexto);
  await driver.wait(async () => {
    const texto = await driver.executeScript(`
      const toaster = document.querySelector("[data-sonner-toaster]");
      return toaster ? toaster.innerText : "";
    `);
    const normalizado = normalizarTexto(texto || "");
    return alvo.some((f) => normalizado.includes(f));
  }, 20000);
  console.log("Alteração gravada (toast de sucesso).");
}

async function confirmarHorarioGravado(driver) {
  const hora = await abrirEdicaoCampanha(driver);
  const valor = (await hora.getAttribute("value")) || "";

  const cancelar = await driver.findElement(
    By.xpath(`${xpathModalEditar()}//button[normalize-space()='Cancelar']`),
  );
  await cancelar.click();
  await pausa(driver, 450);

  if (valor !== HORA_NOVA) {
    throw new Error(
      `Horário não foi gravado: esperado «${HORA_NOVA}», obtido «${valor}».`,
    );
  }
  console.log(`Horário confirmado no formulário: ${valor}.`);
}

async function main() {
  const driver = await criarDriver();

  try {
    console.log("=== RF14 ===");
    await executarPasso(driver, 1, "Login como administrador", "login", () => fazerLogin(driver));
    await limparCampanhasTeste();
    await executarPasso(driver, 2, "Abrir lista e criar campanha de teste", "campanha_criada", async () => {
      await abrirListaCampanhas(driver);
      await criarCampanhaTeste(driver);
    });
    await executarPasso(driver, 3, "Alterar horário da campanha", "horario_alterado", () => alterarHorarioCampanha(driver));
    await executarPasso(driver, 4, "Confirmar horário gravado", "horario_confirmado", () => confirmarHorarioGravado(driver));

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
    await limparCampanhasTeste();
    console.log(`Evidências em: evidencias/${TESTE_ID}/`);
    await pausa(driver, 2000);
    // await driver.quit();
  }
}

main().catch((erro) => {
  console.error("Erro ao executar o script:", erro);
  process.exit(1);
});
