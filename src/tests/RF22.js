/**
 * RF22: Gestão de Comentários — inserir e moderar comentários numa campanha.
 *
 * Resultado esperado: comentário inserido e moderado (Ocultar/Mostrar) pelo administrador.
 * A UI não expõe «Apagar comentário»; o admin pode Ocultar/Mostrar. Limpeza via API.
 *
 * Pré-requisitos:
 * - API Mariva a correr (http://127.0.0.1:3000)
 * - Frontend a correr (http://localhost:5173)
 * - Base de dados com seed: pnpm run db:seed (password Demo2026!)
 *
 * Executar: node "tests/RF22.js"
 */

const fs = require("fs");
const path = require("path");
const { By, until } = require("selenium-webdriver");
const { criarDriver } = require("../criar-driver");
const SEED = require("../test-seed");

// --- Configuração (ajusta se necessário) ---
const BASE_URL = process.env.APP_URL || "http://localhost:5173";
const API_URL = process.env.API_URL || "http://127.0.0.1:3000";
const EMAIL = process.env.TEST_EMAIL || SEED.EMAIL;
const PASSWORD = process.env.TEST_PASSWORD || "Demo2026!";
/** Primeira campanha do seed (Limpeza da Apúlia e Ofir) */
const CAMPAIGN_ID =
  process.env.CAMPAIGN_ID || SEED.CAMPAIGNS.inProgress.id;

const EVIDENCIAS_DIR = path.join(__dirname, "..", "..", "evidencias");
const TESTE_ID = "RF22";
const { createEvidencias } = require("../tc-evidencias");
const { executarPasso, screenshotErro } = createEvidencias(TESTE_ID);
/** Pausa entre passos (ms). Ajusta com TEST_DELAY_MS=3000 node gestaocomentarios.js */
const DELAY_ENTRE_PASSOS_MS = Number(process.env.TEST_DELAY_MS) || 1200;
/** Velocidade da digitação (ms por carácter) */
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

function textoComentarioTeste() {
  return `Comentário de teste Selenium ${new Date().toISOString()}`;
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
    until.urlMatches(/\/(dashboard|campanhas)/),
    20000,
  );
  await pausa(driver);
  console.log("Sessão iniciada com sucesso.");
}

async function abrirComentariosCampanha(driver) {
  const url = `${BASE_URL}/campanhas/${CAMPAIGN_ID}/comentarios`;
  await driver.get(url);

  await driver.wait(
    until.elementLocated(By.id("campaign-panel-comentarios")),
    20000,
  );
  await pausa(driver);
  console.log(`Painel de comentários aberto: ${url}`);
}

async function preencherFormularioComentario(driver, texto) {
  const textarea = await driver.wait(
    until.elementLocated(By.id("campaign-new-comment")),
    10000,
  );
  await pausa(driver);
  await escreverLentamente(textarea, texto);
  await pausa(driver, 600);
  console.log("Formulário de comentário preenchido.");
}

async function submeterComentario(driver, texto) {
  const publicar = await driver.findElement(
    By.xpath(
      "//div[@id='campaign-panel-comentarios']//button[@type='submit' and contains(., 'Publicar')]",
    ),
  );
  await publicar.click();

  await driver.wait(
    until.elementLocated(
      By.xpath(
        `//article[.//p[contains(normalize-space(.), ${JSON.stringify(texto.slice(0, 40))})]]`,
      ),
    ),
    15000,
  );
  await pausa(driver);
  console.log("Comentário publicado e visível na lista.");
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

async function apiApagarComentarioPorTexto(texto) {
  try {
    const token = await apiLogin();
    const res = await fetch(
      `${API_URL}/campaigns/${CAMPAIGN_ID}/comments?page=1&pageSize=100`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );
    if (!res.ok) return;
    const body = await res.json();
    const comentarios = body.data ?? body.items ?? [];
    const alvo = comentarios.find((c) => c.body?.includes(texto.slice(0, 40)));
    if (!alvo) return;
    await fetch(
      `${API_URL}/campaigns/${CAMPAIGN_ID}/comments/${alvo.id}`,
      {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );
    console.log("Comentário de teste removido via API.");
  } catch (e) {
    console.warn("Limpeza API do comentário:", e.message);
  }
}

function xpathArtigoComentario(texto) {
  const trecho = texto.slice(0, 40);
  return `//article[.//p[contains(normalize-space(.), ${JSON.stringify(trecho)})]]`;
}

async function ocultarComentario(driver, texto) {
  const artigo = await driver.wait(
    until.elementLocated(By.xpath(xpathArtigoComentario(texto))),
    10000,
  );

  const botaoOcultar = await artigo.findElement(
    By.xpath(".//button[normalize-space()='Ocultar']"),
  );
  await pausa(driver, 600);
  await botaoOcultar.click();

  await driver.wait(
    until.elementLocated(
      By.xpath(
        `${xpathArtigoComentario(texto)}//*[normalize-space()='Oculto' or normalize-space()='OCULTO']`,
      ),
    ),
    15000,
  );
  await pausa(driver, 500);
  console.log("Comentário ocultado (badge «Oculto» visível).");
}

async function mostrarComentario(driver, texto) {
  const botaoMostrar = await driver.wait(
    until.elementLocated(
      By.xpath(`${xpathArtigoComentario(texto)}//button[normalize-space()='Mostrar']`),
    ),
    10000,
  );
  await pausa(driver, 600);
  await botaoMostrar.click();

  await driver.wait(async () => {
    const badges = await driver.findElements(
      By.xpath(`${xpathArtigoComentario(texto)}//*[normalize-space()='Oculto']`),
    );
    return badges.length === 0;
  }, 15000);

  await pausa(driver, 500);
  console.log("Comentário voltou a estar visível (Mostrar).");
}

async function main() {
  const driver = await criarDriver();

  const textoComentario = textoComentarioTeste();
  try {
    console.log("=== RF22 ===");
    await executarPasso(driver, 1, "Login como administrador", "login", () => fazerLogin(driver));
    await executarPasso(driver, 2, "Abrir comentários da campanha", "comentarios_abertos", () => abrirComentariosCampanha(driver));
    await executarPasso(
      driver,
      3,
      "Formulário de comentário preenchido",
      "comentario_formulario_preenchido",
      () => preencherFormularioComentario(driver, textoComentario),
    );
    await executarPasso(
      driver,
      4,
      "Comentário publicado na lista",
      "comentario_publicado",
      () => submeterComentario(driver, textoComentario),
    );
    await executarPasso(
      driver,
      5,
      "Comentário ocultado pelo administrador",
      "comentario_oculto",
      () => ocultarComentario(driver, textoComentario),
    );
    await executarPasso(
      driver,
      6,
      "Comentário visível após Mostrar",
      "comentario_visivel",
      () => mostrarComentario(driver, textoComentario),
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
    await apiApagarComentarioPorTexto(textoComentario);
    console.log(`Evidências em: evidencias/${TESTE_ID}/`);
    await pausa(driver, 2000);
    // await driver.quit();
  }
}

main().catch((erro) => {
  console.error("Erro ao executar o script:", erro);
  process.exit(1);
});
