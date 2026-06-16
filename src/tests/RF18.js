/**
 * RF18: Eliminar Praias — remover praia sem campanhas e validar catálogo.
 *
 * Resultado esperado:
 * - Praia de teste sem campanhas é removida com sucesso.
 * - Praias do seed permanecem no catálogo (integridade referencial).
 *
 * Pré-requisitos:
 * - API Mariva a correr (http://127.0.0.1:3000)
 * - Frontend a correr (http://localhost:5173)
 * - Base de dados com seed: pnpm run db:seed (password Demo2026!)
 *
 * Executar: node "tests/RF18.js"
 */

const fs = require("fs");
const path = require("path");
const { By, until } = require("selenium-webdriver");
const { criarDriver } = require("../criar-driver");
const SEED = require("../test-seed");

const BASE_URL = process.env.APP_URL || "http://localhost:5173";
const API_URL = process.env.API_URL || "http://127.0.0.1:3000";
const EMAIL = process.env.TEST_EMAIL || SEED.EMAIL;
const PASSWORD = process.env.TEST_PASSWORD || SEED.PASSWORD;

/** Praia criada via API sem campanhas associadas (nome único por execução). */
const PREFIXO_PRAIA_ELIMINAR = "Praia Selenium Eliminar";
const PRAIA_SEM_CAMPANHAS =
  process.env.BEACH_WITHOUT_CAMPAIGNS ||
  `${PREFIXO_PRAIA_ELIMINAR} ${Date.now()}`;
/** Praia do seed usada para validar integridade do catálogo após eliminação. */
const PRAIAS_SEED = [
  SEED.BEACHES.espinho,
  SEED.BEACHES.azurara,
  SEED.BEACHES.codicheira,
];

const DADOS_PRAIA_SEM_CAMPANHAS = {
  name: PRAIA_SEM_CAMPANHAS,
  municipality: "Esposende",
  district: "braga",
  latitude: "41.5362",
  longitude: "-8.7821",
};

const EVIDENCIAS_DIR = path.join(__dirname, "..", "..", "evidencias");
const TESTE_ID = "RF18";
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

let ultimoPedidoApiMs = 0;

async function pausaApi(ms = 600) {
  const agora = Date.now();
  const espera = Math.max(0, ultimoPedidoApiMs + ms - agora);
  if (espera > 0) {
    await new Promise((resolve) => setTimeout(resolve, espera));
  }
  ultimoPedidoApiMs = Date.now();
}

async function apiLogin(email, password) {
  await pausaApi();
  const res = await fetch(`${API_URL}/sessions`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login API falhou (${res.status}).`);
  }
  const body = await res.json();
  const token = body.token || body.session?.token;
  if (!token) {
    throw new Error("Login API não devolveu token.");
  }
  return token;
}

async function apiListarPraias(token) {
  await pausaApi();
  const res = await fetch(`${API_URL}/beaches?page=1&pageSize=100`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Listagem de praias falhou (${res.status}).`);
  }
  const body = await res.json();
  return body.data ?? body.items ?? [];
}

async function apiCriarPraia(token, draft) {
  await pausaApi();
  const res = await fetch(`${API_URL}/beaches`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(draft),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Criação de praia falhou (${res.status}): ${err}`);
  }
}

async function garantirPraiaSemCampanhasDisponivel() {
  await pausaApi();
  const token = await apiLogin(EMAIL, PASSWORD);
  const praias = await apiListarPraias(token);
  const existe = praias.some((p) => p.name === PRAIA_SEM_CAMPANHAS);
  if (existe) {
    console.log(`Praia «${PRAIA_SEM_CAMPANHAS}» disponível para eliminação.`);
    return;
  }
  console.log(`Praia «${PRAIA_SEM_CAMPANHAS}» em falta; a recriar via API…`);
  await apiCriarPraia(token, DADOS_PRAIA_SEM_CAMPANHAS);
  console.log(`Praia «${PRAIA_SEM_CAMPANHAS}» recriada.`);
}

async function reporPraiaSemCampanhas() {
  try {
    await garantirPraiaSemCampanhasDisponivel();
  } catch (erro) {
    console.warn("Não foi possível repor a praia de teste:", erro.message);
  }
}

async function fazerLogin(driver) {
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
  await escreverLentamente(email, EMAIL);
  await pausa(driver, 600);
  await escreverLentamente(password, PASSWORD);
  await pausa(driver, 600);
  await entrar.click();

  await driver.wait(
    until.urlMatches(/\/(dashboard|campanhas|praias|definicoes)/),
    20000,
  );
  await pausa(driver);
  console.log("Sessão iniciada com sucesso.");
}

async function abrirListaPraias(driver) {
  await driver.get(`${BASE_URL}/praias`);

  await driver.wait(
    until.elementLocated(By.id("beaches-tab-list")),
    20000,
  );

  const tabLista = await driver.findElement(By.id("beaches-tab-list"));
  const activa = (await tabLista.getAttribute("aria-selected")) === "true";
  if (!activa) {
    await tabLista.click();
    await pausa(driver, 450);
  }

  await driver.wait(async () => {
    const loading = await driver.findElements(
      By.xpath("//*[contains(normalize-space(),'A carregar') and not(contains(.,'mapa'))]"),
    );
    return loading.length === 0;
  }, 20000);

  await driver.wait(
    until.elementLocated(By.css("table tbody tr")),
    20000,
  );
  await pausa(driver);
  console.log("Lista de praias aberta.");
}

function xpathLinhaPraia(nome) {
  return `//table//tbody//tr[.//td[normalize-space()=${JSON.stringify(nome)}]]`;
}

async function irParaPrimeiraPagina(driver) {
  for (let i = 0; i < 6; i += 1) {
    const anterior = await driver.findElements(
      By.xpath("//button[normalize-space()='Anterior' and not(@disabled)]"),
    );
    if (anterior.length === 0) {
      return;
    }
    await anterior[0].click();
    await pausa(driver, 450);
  }
}

async function irParaPaginaComPraia(driver, nome) {
  await irParaPrimeiraPagina(driver);

  for (let pagina = 0; pagina < 6; pagina += 1) {
    const linhas = await driver.findElements(By.xpath(xpathLinhaPraia(nome)));
    if (linhas.length > 0) {
      return linhas[0];
    }

    const seguinte = await driver.findElements(
      By.xpath("//button[normalize-space()='Seguinte' and not(@disabled)]"),
    );
    if (seguinte.length === 0) {
      break;
    }
    await seguinte[0].click();
    await pausa(driver, 600);
  }

  throw new Error(`Praia «${nome}» não encontrada na lista (paginação esgotada).`);
}

async function praiaVisivelNaLista(driver, nome) {
  try {
    await irParaPaginaComPraia(driver, nome);
    return true;
  } catch {
    return false;
  }
}

async function clicarApagarPraia(driver, nome) {
  const linha = await irParaPaginaComPraia(driver, nome);
  const botaoApagar = await linha.findElement(
    By.css("button[aria-label='Apagar']"),
  );
  await pausa(driver, 450);
  await botaoApagar.click();
  await pausa(driver, 450);

  await driver.wait(
    until.elementLocated(By.id("delete-beach-title")),
    10000,
  );
  console.log(`Modal de eliminação aberto para «${nome}».`);
}

async function confirmarEliminarModal(driver) {
  const confirmar = await driver.wait(
    until.elementLocated(
      By.xpath(
        "//*[@id='delete-beach-title']/ancestor::div[@role='dialog']//button[normalize-space()='Eliminar Praia']",
      ),
    ),
    10000,
  );
  await confirmar.click();
  await pausa(driver, 1000);
}

function normalizarTexto(texto) {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

async function lerTextosToastVisiveis(driver) {
  return driver.executeScript(`
    const partes = [];
    const toaster = document.querySelector("[data-sonner-toaster]");
    if (toaster) {
      partes.push(toaster.innerText || "");
    }
    document.querySelectorAll("[data-sonner-toast]").forEach((toast) => {
      const estilo = window.getComputedStyle(toast);
      if (estilo.display === "none" || estilo.visibility === "hidden") {
        return;
      }
      partes.push(toast.innerText || "");
      toast.querySelectorAll("[data-title], [data-description]").forEach((no) => {
        partes.push(no.textContent || "");
      });
    });
    return partes.filter(Boolean).join("\\n");
  `);
}

async function aguardarToastsDesaparecerem(driver, timeoutMs = 10000) {
  await driver
    .wait(async () => {
      const texto = await lerTextosToastVisiveis(driver);
      return !texto.trim();
    }, timeoutMs)
    .catch(() => {});
  await pausa(driver, 300);
}

async function aguardarToastComTexto(driver, textosEsperados, timeoutMs = 20000) {
  const alvo = textosEsperados.map(normalizarTexto);
  let ultimoTexto = "";

  await driver.wait(async () => {
    ultimoTexto = await lerTextosToastVisiveis(driver);
    if (!ultimoTexto.trim()) {
      return false;
    }
    const normalizado = normalizarTexto(ultimoTexto);
    return alvo.some((fragmento) => normalizado.includes(fragmento));
  }, timeoutMs);

  console.log(`Toast: «${ultimoTexto.replace(/\s+/g, " ")}»`);
  return ultimoTexto;
}

async function confirmarCatalogoSeedIntacto() {
  const token = await apiLogin(EMAIL, PASSWORD);
  const praias = await apiListarPraias(token);
  const nomes = praias.map((p) => p.name);

  for (const nome of PRAIAS_SEED) {
    if (!nomes.includes(nome)) {
      throw new Error(
        `Praia seed «${nome}» em falta no catálogo após eliminação de teste.`,
      );
    }
  }

  console.log(
    `Integridade confirmada: ${PRAIAS_SEED.length} praias do seed presentes.`,
  );
}

async function confirmarPraiaTesteNaLista(driver) {
  const visivel = await praiaVisivelNaLista(driver, PRAIA_SEM_CAMPANHAS);
  if (!visivel) {
    throw new Error(
      `Praia «${PRAIA_SEM_CAMPANHAS}» devia estar visível na lista antes de eliminar.`,
    );
  }
  console.log(`Praia «${PRAIA_SEM_CAMPANHAS}» visível na lista.`);
}

async function abrirModalEliminarPraia(driver) {
  await clicarApagarPraia(driver, PRAIA_SEM_CAMPANHAS);
  await pausa(driver, 500);
}

async function confirmarEliminacaoNoModal(driver) {
  await confirmarEliminarModal(driver);
  await aguardarToastComTexto(driver, ["praia eliminada"]);
  await aguardarToastsDesaparecerem(driver);
  console.log(`Eliminação confirmada para «${PRAIA_SEM_CAMPANHAS}».`);
}

async function confirmarPraiaRemovidaDaLista(driver) {
  await irParaPrimeiraPagina(driver);
  const aindaVisivel = await praiaVisivelNaLista(driver, PRAIA_SEM_CAMPANHAS);
  if (aindaVisivel) {
    throw new Error(
      `A praia «${PRAIA_SEM_CAMPANHAS}» devia ter sido removida da lista.`,
    );
  }
  console.log(`Praia «${PRAIA_SEM_CAMPANHAS}» removida da listagem.`);
}

async function confirmarCatalogoSeedNaLista(driver) {
  for (const nome of PRAIAS_SEED) {
    if (!(await praiaVisivelNaLista(driver, nome))) {
      throw new Error(`Praia seed «${nome}» em falta na lista.`);
    }
    console.log(`Praia seed presente na lista: ${nome}`);
  }

  await confirmarCatalogoSeedIntacto();
}

async function main() {
  const driver = await criarDriver();

  try {
    console.log("=== RF18 ===");
    await executarPasso(driver, 1, "Login como administrador", "login", () => fazerLogin(driver));
    await garantirPraiaSemCampanhasDisponivel();
    await executarPasso(driver, 2, "Abrir catálogo de praias", "catalogo_praias", () => abrirListaPraias(driver));
    await executarPasso(
      driver,
      3,
      "Praia de teste visível na lista",
      "praia_na_lista",
      () => confirmarPraiaTesteNaLista(driver),
    );
    await executarPasso(
      driver,
      4,
      "Modal de eliminar praia aberto",
      "modal_eliminar",
      () => abrirModalEliminarPraia(driver),
    );
    await executarPasso(
      driver,
      5,
      "Eliminação confirmada",
      "praia_eliminada",
      () => confirmarEliminacaoNoModal(driver),
    );
    await executarPasso(
      driver,
      6,
      "Praia removida da listagem",
      "praia_removida_lista",
      () => confirmarPraiaRemovidaDaLista(driver),
    );
    await executarPasso(
      driver,
      7,
      "Praias do seed intactas no catálogo",
      "catalogo_intacto",
      () => confirmarCatalogoSeedNaLista(driver),
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
    await reporPraiaSemCampanhas();
    console.log(`Evidências em: evidencias/${TESTE_ID}/`);
    await pausa(driver, 2000);
    // await driver.quit();
  }
}

main().catch((erro) => {
  console.error("Erro ao executar o script:", erro);
  process.exit(1);
});
