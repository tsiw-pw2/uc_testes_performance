/**
 * RF20: Calcular Índices Ambientais — recolha actualiza o índice de poluição.
 *
 * Resultado esperado: cálculo automático e novo valor do índice de poluição visível.
 *
 * Pré-requisitos:
 * - API Mariva a correr (http://127.0.0.1:3000)
 * - Frontend a correr (http://localhost:5173)
 * - Base de dados com seed: pnpm run db:seed (password Demo2026!)
 *
 * Executar: node "tests/RF20.js"
 */

const fs = require("fs");
const path = require("path");
const { By, until } = require("selenium-webdriver");
const { criarDriver } = require("../criar-driver");
const SEED = require("../test-seed");

const BASE_URL = process.env.APP_URL || "http://localhost:5173";
const EMAIL = process.env.TEST_EMAIL || SEED.EMAIL;
const PASSWORD = process.env.TEST_PASSWORD || "Demo2026!";

const CAMPAIGN_ID =
  process.env.CAMPAIGN_ID || SEED.CAMPAIGNS.inProgress.id;
const QUANTIDADE = process.env.WASTE_QUANTITY || "50";
const PRAIA_NOME = process.env.WASTE_BEACH_NAME || SEED.BEACHES.azurara;
const RESIDUO_NOME = process.env.WASTE_ITEM_NAME || SEED.WASTE.garrafaPet;

/** Etiquetas possíveis do índice/peso na UI (por ordem de preferência). */
const ETIQUETAS_INDICE = [
  "Peso estimado",
  "Peso pesado",
  "Índice de poluição",
  "Indice de poluicao",
  "Índice ambiental",
  "Indice ambiental",
];

const EVIDENCIAS_DIR = path.join(__dirname, "..", "..", "evidencias");
const TESTE_ID = "RF20";
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

async function aguardarCampanhaCarregada(driver) {
  await driver.wait(async () => {
    const aCarregar = await driver.findElements(
      By.xpath("//*[contains(normalize-space(),'A carregar detalhes')]"),
    );
    if (aCarregar.length > 0) {
      return false;
    }
    const tabs = await driver.findElements(By.css('[id^="campaign-tab-"]'));
    return tabs.length > 0;
  }, 30000);
}

async function aguardarCarregamentoPainel(driver, panelId) {
  await driver.wait(async () => {
    const paineis = await driver.findElements(By.id(panelId));
    if (paineis.length === 0) {
      return false;
    }
    const loading = await paineis[0].findElements(
      By.xpath(".//*[contains(normalize-space(),'A carregar')]"),
    );
    return loading.length === 0;
  }, 20000);
}

async function irParaTabCampanha(driver, tab) {
  const panelId = `campaign-panel-${tab}`;
  const tabId = `campaign-tab-${tab}`;
  const url = `${BASE_URL}/campanhas/${CAMPAIGN_ID}/${tab}`;

  const urlAtual = await driver.getCurrentUrl();
  const naCampanha = urlAtual.includes(`/campanhas/${CAMPAIGN_ID}`);

  if (naCampanha) {
    try {
      const tabEl = await driver.wait(
        until.elementLocated(By.id(tabId)),
        10000,
      );
      await pausa(driver, 300);
      await tabEl.click();
    } catch {
      await driver.get(url);
    }
  } else {
    await driver.get(url);
  }

  await aguardarCampanhaCarregada(driver);
  await driver.wait(until.elementLocated(By.id(panelId)), 30000);
  await aguardarCarregamentoPainel(driver, panelId);
  await pausa(driver);
}

function parseValorNumerico(texto) {
  const limpo = texto.replace(/\u00a0/g, " ").trim();
  if (!limpo || limpo === "—" || limpo === "-") {
    return 0;
  }
  const match = limpo.match(/([\d]+(?:[.,]\d+)?)/);
  if (!match) {
    return Number.NaN;
  }
  return Number.parseFloat(match[1].replace(",", "."));
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

async function abrirInformacoesCampanha(driver) {
  await irParaTabCampanha(driver, "informacoes");
}

async function lerIndiceAmbiental(driver) {
  const porId = await driver.findElements(
    By.css(
      "#campaign-pollution-index, #campaign-environmental-index, [data-testid='campaign-pollution-index']",
    ),
  );
  for (const el of porId) {
    if (await el.isDisplayed()) {
      const texto = (await el.getText()).trim();
      const valor = parseValorNumerico(texto);
      if (Number.isFinite(valor)) {
        console.log(`Índice (elemento dedicado): ${texto} → ${valor}`);
        return { etiqueta: "elemento dedicado", texto, valor };
      }
    }
  }

  for (const etiqueta of ETIQUETAS_INDICE) {
    const elementos = await driver.findElements(
      By.xpath(
        `//div[@id='campaign-panel-informacoes']//p[contains(normalize-space(), ${JSON.stringify(etiqueta)})]/following-sibling::div[1]`,
      ),
    );
    if (elementos.length === 0) {
      continue;
    }
    const texto = (await elementos[0].getText()).trim();
    const valor = parseValorNumerico(texto);
    if (!Number.isFinite(valor)) {
      throw new Error(
        `Valor do índice «${etiqueta}» não é numérico: «${texto}».`,
      );
    }
    const rotulo =
      texto === "—" || texto === "-"
        ? `${etiqueta} (sem recolhas — 0)`
        : `${etiqueta}: ${texto} → ${valor}`;
    console.log(rotulo);
    return { etiqueta, texto, valor };
  }

  throw new Error(
    "Não foi encontrado o índice de poluição/ambiental no painel Informações.",
  );
}

async function abrirRecolhasCampanha(driver) {
  await irParaTabCampanha(driver, "recolhas");
}

function modalRecolha() {
  return By.xpath(
    "//div[@role='dialog'][.//*[@id='create-waste-collection-title']]",
  );
}

async function escolherOpcaoSelect(driver, indiceNoModal, textoOpcao) {
  const modal = await driver.findElement(modalRecolha());
  const comboboxes = await modal.findElements(By.css('[role="combobox"]'));
  const combobox = comboboxes[indiceNoModal];
  await driver.wait(async () => !(await combobox.getAttribute("aria-disabled")), 15000).catch(
    () => {},
  );
  await combobox.click();
  await pausa(driver, 400);

  const opcao = await driver.wait(
    until.elementLocated(
      By.xpath(
        `//div[@role='option'][.//span[normalize-space()=${JSON.stringify(textoOpcao)}] or normalize-space()=${JSON.stringify(textoOpcao)}]`,
      ),
    ),
    15000,
  );
  await opcao.click();
  await pausa(driver, 450);
}

async function aguardarOpcoesResiduos(driver) {
  const modal = await driver.findElement(modalRecolha());
  await driver.wait(async () => {
    const comboboxes = await modal.findElements(By.css('[role="combobox"]'));
    if (comboboxes.length < 2) {
      return false;
    }
    const resíduo = comboboxes[1];
    const disabled = await resíduo.getAttribute("disabled");
    const ariaDisabled = await resíduo.getAttribute("aria-disabled");
    const className = (await resíduo.getAttribute("class")) || "";
    return (
      disabled !== "true" &&
      ariaDisabled !== "true" &&
      !className.includes("pointer-events-none")
    );
  }, 20000);
  await pausa(driver, 300);
}

async function obterBotaoGuardar(driver) {
  const modal = await driver.findElement(modalRecolha());
  return modal.findElement(
    By.xpath(".//button[@type='submit' and normalize-space()='Guardar']"),
  );
}

async function registarRecolha(driver) {
  const botao = await driver.wait(
    until.elementLocated(
      By.xpath(
        "//div[@id='campaign-panel-recolhas']//button[contains(normalize-space(),'Registar recolha')]",
      ),
    ),
    10000,
  );
  await pausa(driver, 600);
  await botao.click();

  await driver.wait(
    until.elementLocated(By.id("create-waste-collection-title")),
    10000,
  );
  await aguardarOpcoesResiduos(driver);
  await pausa(driver);

  await escolherOpcaoSelect(driver, 0, PRAIA_NOME);
  await escolherOpcaoSelect(driver, 1, RESIDUO_NOME);

  const qty = await driver.findElement(By.id("create-waste-collection-qty"));
  await qty.clear();
  await escreverLentamente(qty, QUANTIDADE);
  await pausa(driver, 600);

  const guardar = await obterBotaoGuardar(driver);
  await driver.wait(async () => await guardar.isEnabled(), 10000);
  await guardar.click();

  await driver.wait(async () => {
    const modais = await driver.findElements(
      By.id("create-waste-collection-title"),
    );
    return modais.length === 0;
  }, 15000);

  await aguardarCarregamentoPainel(driver, "campaign-panel-recolhas");
  await verificarRecolhaNaTabela(driver);
  await pausa(driver);
  console.log(
    `Recolha registada: ${PRAIA_NOME} · ${RESIDUO_NOME} · ${QUANTIDADE} un.`,
  );
}

async function verificarRecolhaNaTabela(driver) {
  await driver.wait(
    until.elementLocated(
      By.xpath(
        `//div[@id='campaign-panel-recolhas']//table//tr[.//td[normalize-space()=${JSON.stringify(RESIDUO_NOME)}] and .//td[normalize-space()=${JSON.stringify(QUANTIDADE)}]]`,
      ),
    ),
    20000,
  );
  console.log("Recolha confirmada na tabela de recolhas.");
}

async function apagarRecolhaTeste(driver) {
  const botaoApagar = await driver.wait(
    until.elementLocated(
      By.xpath(
        `//div[@id='campaign-panel-recolhas']//tr[.//td[normalize-space()=${JSON.stringify(RESIDUO_NOME)}] and .//td[normalize-space()=${JSON.stringify(QUANTIDADE)}]]//button[@aria-label='Apagar recolha']`,
      ),
    ),
    20000,
  );
  await pausa(driver, 600);
  await botaoApagar.click();
  await pausa(driver, 600);

  const confirmar = await driver.wait(
    until.elementLocated(
      By.xpath(
        "//div[@role='dialog'][.//*[@id='delete-waste-collection-title']]//button[normalize-space()='Apagar']",
      ),
    ),
    10000,
  );
  await confirmar.click();
  await pausa(driver);

  await driver.wait(async () => {
    const linhas = await driver.findElements(
      By.xpath(
        `//div[@id='campaign-panel-recolhas']//tr[.//td[normalize-space()=${JSON.stringify(RESIDUO_NOME)}] and .//td[normalize-space()=${JSON.stringify(QUANTIDADE)}]]`,
      ),
    );
    return linhas.length === 0;
  }, 15000);

  console.log("Recolha de teste removida.");
}

async function limparRecolhaTesteAnterior(driver) {
  await abrirRecolhasCampanha(driver);
  const linhas = await driver.findElements(
    By.xpath(
      `//div[@id='campaign-panel-recolhas']//tr[.//td[normalize-space()=${JSON.stringify(RESIDUO_NOME)}] and .//td[normalize-space()=${JSON.stringify(QUANTIDADE)}]]`,
    ),
  );
  if (linhas.length === 0) {
    return;
  }
  console.log("Recolha de teste anterior encontrada; a remover…");
  await apagarRecolhaTeste(driver);
}

async function verificarActualizacaoIndice(indiceAntes, indiceDepois) {
  if (indiceDepois.valor <= indiceAntes.valor) {
    throw new Error(
      `O índice devia aumentar após a recolha. Antes (${indiceAntes.etiqueta}): ${indiceAntes.texto} (${indiceAntes.valor}); depois: ${indiceDepois.texto} (${indiceDepois.valor}).`,
    );
  }

  if (indiceDepois.texto === "—" || indiceDepois.texto === "-") {
    throw new Error(
      "Após a recolha, o índice/peso estimado continua «—»; a recolha pode não ter sido contabilizada.",
    );
  }

  console.log(
    `Índice actualizado: ${indiceAntes.texto} (${indiceAntes.valor}) → ${indiceDepois.texto} (${indiceDepois.valor}) [${indiceDepois.etiqueta}].`,
  );
}

async function main() {
  const driver = await criarDriver();

  try {
    console.log("=== RF20 ===");
    let indiceAntes;
    await executarPasso(driver, 1, "Login como administrador", "login", () => fazerLogin(driver));
    await limparRecolhaTesteAnterior(driver);
    await executarPasso(driver, 2, "Ler índice ambiental antes da recolha", "indice_antes", async () => {
      await abrirInformacoesCampanha(driver);
      indiceAntes = await lerIndiceAmbiental(driver);
    });
    await executarPasso(driver, 3, "Registar nova recolha", "recolha_registada", async () => {
      await abrirRecolhasCampanha(driver);
      await registarRecolha(driver);
    });
    await executarPasso(driver, 4, "Confirmar actualização do índice ambiental", "indice_atualizado", async () => {
      await abrirInformacoesCampanha(driver);
      const indiceDepois = await lerIndiceAmbiental(driver);
      await verificarActualizacaoIndice(indiceAntes, indiceDepois);
    });
    await irParaTabCampanha(driver, "recolhas");
    await apagarRecolhaTeste(driver);

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
