/**
 * RF17: Editar Praias — alterar dados de uma praia existente.
 *
 * Resultado esperado: o sistema actualiza a informação e exibe
 * «As alterações foram guardadas» (ou equivalente).
 *
 * Pré-requisitos:
 * - API Mariva a correr (http://127.0.0.1:3000)
 * - Frontend a correr (http://localhost:5173)
 * - Base de dados com seed: pnpm run db:seed (password Demo2026!)
 *
 * Executar: node "tests/RF17.js"
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

/** Praia do seed — distrito Aveiro, concelho Espinho. */
const PRAIA_NOME = process.env.BEACH_NAME || SEED.BEACHES.azurara;
const CONCELHO_ORIGINAL = process.env.BEACH_MUNICIPALITY || "Vila do Conde";
/** Concelho alternativo no distrito Porto. */
const CONCELHO_NOVO = process.env.BEACH_MUNICIPALITY_NEW || "Maia";
const DISTRITO = process.env.BEACH_DISTRICT || "porto";

const DADOS_ORIGINAIS = {
  name: PRAIA_NOME,
  municipality: CONCELHO_ORIGINAL,
  district: DISTRITO,
  latitude: process.env.BEACH_LATITUDE || "41.3501",
  longitude: process.env.BEACH_LONGITUDE || "-8.7462",
};

const EVIDENCIAS_DIR = path.join(__dirname, "..", "..", "evidencias");
const TESTE_ID = "RF17";
const { createEvidencias } = require("../tc-evidencias");
const { executarPasso, screenshotErro } = createEvidencias(TESTE_ID);
const DELAY_ENTRE_PASSOS_MS = Number(process.env.TEST_DELAY_MS) || 1200;
const DELAY_DIGITACAO_MS = Number(process.env.TEST_TYPING_MS) || 50;

const TEXTOS_SUCESSO_GUARDAR = [
  "alterações guardadas",
  "alteracoes guardadas",
  "as alterações foram guardadas",
  "as alteracoes foram guardadas",
  "praia atualizada",
];

let ultimoPedidoApiMs = 0;

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

async function apiAtualizarPraia(token, id, draft) {
  await pausaApi();
  const res = await fetch(`${API_URL}/beaches/${id}`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(draft),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Actualização de praia falhou (${res.status}): ${err}`);
  }
}

async function reporDadosOriginaisPraia() {
  try {
    const token = await apiLogin(EMAIL, PASSWORD);
    const praias = await apiListarPraias(token);
    const praia = praias.find((p) => p.name === PRAIA_NOME);
    if (!praia) {
      console.warn(`Praia «${PRAIA_NOME}» não encontrada para repor dados.`);
      return;
    }
    await apiAtualizarPraia(token, praia.id, DADOS_ORIGINAIS);
    console.log(
      `Dados originais repostos: ${PRAIA_NOME} · ${CONCELHO_ORIGINAL}.`,
    );
  } catch (erro) {
    console.warn("Não foi possível repor dados originais:", erro.message);
  }
}

function normalizarTexto(texto) {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
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
    until.urlMatches(/\/(dashboard|campanhas|praias)/),
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
  if ((await tabLista.getAttribute("aria-selected")) !== "true") {
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

async function lerConcelhoNaTabela(driver, nome) {
  const linha = await irParaPaginaComPraia(driver, nome);
  const celulas = await linha.findElements(By.css("td"));
  if (celulas.length < 3) {
    throw new Error("Linha da praia sem coluna de concelho.");
  }
  return (await celulas[2].getText()).trim();
}

function modalEditarPraia() {
  return By.xpath(
    "//h3[@id='edit-beach-title']/ancestor::div[@role='dialog']",
  );
}

async function abrirEdicaoPraia(driver, nome) {
  const linha = await irParaPaginaComPraia(driver, nome);
  const botaoEditar = await linha.findElement(
    By.css("button[aria-label='Editar']"),
  );
  await pausa(driver, 450);
  await botaoEditar.click();

  await driver.wait(until.elementLocated(By.id("edit-beach-title")), 10000);
  await pausa(driver, 450);
  console.log(`Modal «Editar Praia» aberto para «${nome}».`);
}

async function escolherOpcaoSelectNoModal(driver, indiceCombobox, textoOpcao) {
  const modal = await driver.findElement(modalEditarPraia());
  const comboboxes = await modal.findElements(By.css('[role="combobox"]'));
  if (comboboxes.length <= indiceCombobox) {
    throw new Error("Modal de edição sem select esperado.");
  }

  const combobox = comboboxes[indiceCombobox];
  await combobox.click();
  await pausa(driver, 400);

  const listbox = await driver.wait(
    until.elementLocated(By.css('[role="listbox"]')),
    10000,
  );

  const opcao = await driver.wait(async () => {
    const candidatas = await listbox.findElements(
      By.xpath(
        `.//*[@role='option'][.//span[normalize-space()=${JSON.stringify(textoOpcao)}] or normalize-space()=${JSON.stringify(textoOpcao)}]`,
      ),
    );
    return candidatas.length > 0 ? candidatas[0] : null;
  }, 15000);

  await driver.executeScript(
    "arguments[0].scrollIntoView({ block: 'nearest' });",
    opcao,
  );
  await pausa(driver, 300);
  await opcao.click();
  await pausa(driver, 450);
}

async function alterarConcelhoNoModal(driver, concelhoNovo) {
  await escolherOpcaoSelectNoModal(driver, 1, concelhoNovo);
  console.log(`Concelho alterado para «${concelhoNovo}».`);
}

async function clicarGuardarAlteracoes(driver) {
  const modal = await driver.findElement(modalEditarPraia());
  const guardar = await modal.findElement(
    By.xpath(".//button[@type='submit' and normalize-space()='Guardar alterações']"),
  );

  await driver.wait(async () => await guardar.isEnabled(), 10000);
  await guardar.click();
  await pausa(driver, 900);

  await driver.wait(async () => {
    const modais = await driver.findElements(By.id("edit-beach-title"));
    return modais.length === 0;
  }, 15000);
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
    });
    return partes.filter(Boolean).join("\\n");
  `);
}

async function aguardarMensagemGuardada(driver, timeoutMs = 20000) {
  const alvo = TEXTOS_SUCESSO_GUARDAR.map(normalizarTexto);
  let ultimoTexto = "";

  await driver.wait(async () => {
    ultimoTexto = await lerTextosToastVisiveis(driver);
    if (!ultimoTexto.trim()) {
      return false;
    }
    const normalizado = normalizarTexto(ultimoTexto);
    return alvo.some((fragmento) => normalizado.includes(fragmento));
  }, timeoutMs);

  console.log(`Mensagem de sucesso: «${ultimoTexto.replace(/\s+/g, " ")}»`);
  return ultimoTexto;
}

async function confirmarConcelhoActualNaLista(driver) {
  const concelho = await lerConcelhoNaTabela(driver, PRAIA_NOME);
  console.log(`Concelho actual na lista: ${concelho}`);

  if (concelho !== CONCELHO_ORIGINAL) {
    throw new Error(
      `Concelho inicial devia ser «${CONCELHO_ORIGINAL}»; obtido: «${concelho}».`,
    );
  }
}

async function abrirModalEdicaoDadosAtuais(driver) {
  await abrirEdicaoPraia(driver, PRAIA_NOME);
}

async function preencherConcelhoAtualizadoNoModal(driver) {
  await alterarConcelhoNoModal(driver, CONCELHO_NOVO);
  await pausa(driver, 500);
  console.log(`Formulário com concelho «${CONCELHO_NOVO}».`);
}

async function guardarEdicaoPraia(driver) {
  await clicarGuardarAlteracoes(driver);
  await aguardarMensagemGuardada(driver);
  console.log("Alterações da praia guardadas.");
}

async function confirmarConcelhoActualizadoNaLista(driver) {
  await driver.wait(async () => {
    const concelho = await lerConcelhoNaTabela(driver, PRAIA_NOME);
    return concelho === CONCELHO_NOVO;
  }, 20000);

  const concelho = await lerConcelhoNaTabela(driver, PRAIA_NOME);
  if (concelho !== CONCELHO_NOVO) {
    throw new Error(
      `Concelho na tabela incorrecto: esperado «${CONCELHO_NOVO}», obtido «${concelho}».`,
    );
  }

  console.log(
    `Praia actualizada na lista: ${PRAIA_NOME} · ${CONCELHO_ORIGINAL} → ${concelho}.`,
  );
}

async function main() {
  const driver = await criarDriver();

  try {
    console.log("=== RF17 ===");
    await executarPasso(driver, 1, "Login como administrador", "login", () => fazerLogin(driver));
    await reporDadosOriginaisPraia();
    await executarPasso(driver, 2, "Abrir lista de praias", "lista_praias", () => abrirListaPraias(driver));
    await executarPasso(
      driver,
      3,
      "Concelho actual na lista",
      "dados_atuais_lista",
      () => confirmarConcelhoActualNaLista(driver),
    );
    await executarPasso(
      driver,
      4,
      "Modal de edição com dados actuais",
      "modal_dados_atuais",
      () => abrirModalEdicaoDadosAtuais(driver),
    );
    await executarPasso(
      driver,
      5,
      "Formulário com concelho actualizado",
      "modal_dados_atualizados",
      () => preencherConcelhoAtualizadoNoModal(driver),
    );
    await executarPasso(
      driver,
      6,
      "Alterações guardadas com sucesso",
      "alteracao_guardada",
      () => guardarEdicaoPraia(driver),
    );
    await executarPasso(
      driver,
      7,
      "Concelho actualizado na lista",
      "dados_atualizados_lista",
      () => confirmarConcelhoActualizadoNaLista(driver),
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
    await reporDadosOriginaisPraia();
    console.log(`Evidências em: evidencias/${TESTE_ID}/`);
    await pausa(driver, 2000);
    // await driver.quit();
  }
}

main().catch((erro) => {
  console.error("Erro ao executar o script:", erro);
  process.exit(1);
});
