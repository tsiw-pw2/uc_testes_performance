/**
 * RF06: Contabilizar campanhas — total de participações no perfil do voluntário.
 *
 * Resultado esperado: o sistema mostra o número total de participações.
 *
 * Pré-requisitos:
 * - API Mariva a correr (http://127.0.0.1:3000)
 * - Frontend a correr (http://localhost:5173)
 * - Base de dados com seed: pnpm run db:seed (password Demo2026!)
 *
 * Executar: node "tests/RF06.js"
 */

const fs = require("fs");
const path = require("path");
const { By, until } = require("selenium-webdriver");
const { criarDriver } = require("../criar-driver");

const SEED = require("../test-seed");
const { fecharDriver } = require("../test-campaign-voluntarios");

const BASE_URL = process.env.APP_URL || "http://localhost:5173";
const EMAIL = process.env.TEST_EMAIL || SEED.EMAIL;
const PASSWORD = process.env.TEST_PASSWORD || SEED.PASSWORD;

/** Voluntário do seed: Carla Voluntária (2 inscrições no seed). */
const VOLUNTARIO_NOME = process.env.VOLUNTEER_NAME || SEED.USERS.volunteer1.name;
const VOLUNTARIO_ID =
  process.env.VOLUNTEER_USER_ID || SEED.USERS.volunteer1.id;
const MIN_PARTICIPACOES = Number(process.env.MIN_PARTICIPATIONS) || 1;

const EVIDENCIAS_DIR = path.join(__dirname, "..", "..", "evidencias");
const TESTE_ID = "RF06";
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
    until.urlMatches(/\/(dashboard|campanhas|definicoes)/),
    20000,
  );
  await pausa(driver);
  console.log("Sessão iniciada com sucesso.");
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

async function abrirPerfilVoluntario(driver) {
  await driver.get(
    `${BASE_URL}/definicoes/utilizadores/${VOLUNTARIO_ID}/informacao`,
  );
  await driver.wait(
    until.urlContains(`/utilizadores/${VOLUNTARIO_ID}`),
    20000,
  );
  await aguardarCarregamento(driver);
  await pausa(driver);
  console.log(`Perfil aberto: ${VOLUNTARIO_NOME}`);
}

async function confirmarNomeNoPerfil(driver, nomeVoluntario) {
  const titulo = await driver.wait(
    until.elementLocated(
      By.xpath(
        `//h3[normalize-space()=${JSON.stringify(nomeVoluntario)}]`,
      ),
    ),
    15000,
  );
  const nome = (await titulo.getText()).trim();
  if (nome !== nomeVoluntario) {
    throw new Error(
      `Perfil devia mostrar «${nomeVoluntario}»; obtido: «${nome}».`,
    );
  }
  console.log(`Perfil do voluntário confirmado: ${nome}.`);
}

async function lerTotalParticipacoesMetrica(driver) {
  const cartao = await driver.wait(
    until.elementLocated(
      By.xpath(
        "//div[contains(@class,'rounded-xl')][.//p[normalize-space()='Participações']]",
      ),
    ),
    15000,
  );
  const valorEl = await cartao.findElement(
    By.xpath(".//p[contains(@class,'text-2xl')]"),
  );
  const texto = (await valorEl.getText()).trim();
  const total = Number.parseInt(texto, 10);

  if (!Number.isFinite(total) || total < 0) {
    throw new Error(
      `Total de participações inválido na métrica: «${texto}».`,
    );
  }

  console.log(`Total de participações (métrica do perfil): ${total}`);
  return total;
}

async function abrirSeparadorParticipacoes(driver) {
  await driver.get(
    `${BASE_URL}/definicoes/utilizadores/${VOLUNTARIO_ID}/participacoes`,
  );
  await driver.wait(until.urlContains("/participacoes"), 15000);
  await aguardarCarregamento(driver);
  await pausa(driver);
}

async function lerTotalParticipacoesPaginacao(driver) {
  const elementos = await driver.findElements(
    By.xpath("//*[contains(normalize-space(),'no total')]"),
  );
  for (const el of elementos) {
    const texto = (await el.getText()).trim();
    const match = texto.match(/\((\d+)\s+no total\)/);
    if (match) {
      const total = Number.parseInt(match[1], 10);
      console.log(`Total de participações (paginação da lista): ${total}`);
      return total;
    }
  }

  const mensagemVazia = await driver.findElements(
    By.xpath(
      "//*[contains(normalize-space(),'ainda não participou em campanhas')]",
    ),
  );
  if (mensagemVazia.length > 0) {
    return 0;
  }

  throw new Error(
    "Não foi possível ler o total de participações na lista (paginação).",
  );
}

async function verificarTotalParticipacoes(driver) {
  await confirmarNomeNoPerfil(driver, VOLUNTARIO_NOME);

  const totalMetrica = await lerTotalParticipacoesMetrica(driver);
  if (totalMetrica < MIN_PARTICIPACOES) {
    throw new Error(
      `O total de participações devia ser pelo menos ${MIN_PARTICIPACOES}; obtido: ${totalMetrica}.`,
    );
  }

  await abrirSeparadorParticipacoes(driver);
  const totalLista = await lerTotalParticipacoesPaginacao(driver);

  if (totalLista !== totalMetrica) {
    throw new Error(
      `O total na métrica (${totalMetrica}) não coincide com o da lista (${totalLista}).`,
    );
  }

  console.log(
    `Verificação concluída: ${totalMetrica} participação(ões) no perfil de ${VOLUNTARIO_NOME}.`,
  );
}

async function main() {
  const driver = await criarDriver();

  try {
    console.log("=== RF06 ===");
    let totalMetrica;
    await executarPasso(driver, 1, "Login como administrador", "login", () => fazerLogin(driver));
    await executarPasso(driver, 2, "Abrir perfil do voluntário", "perfil_aberto", () => abrirPerfilVoluntario(driver));
    await executarPasso(driver, 3, "Confirmar nome e métrica de participações", "metrica_participacoes", async () => {
      await confirmarNomeNoPerfil(driver, VOLUNTARIO_NOME);
      totalMetrica = await lerTotalParticipacoesMetrica(driver);
      if (totalMetrica < MIN_PARTICIPACOES) {
        throw new Error(`O total devia ser pelo menos ${MIN_PARTICIPACOES}; obtido: ${totalMetrica}.`);
      }
    });
    await executarPasso(driver, 4, "Confirmar total na lista de participações", "lista_participacoes", async () => {
      await abrirSeparadorParticipacoes(driver);
      const totalLista = await lerTotalParticipacoesPaginacao(driver);
      if (totalLista !== totalMetrica) {
        throw new Error(`Métrica (${totalMetrica}) ≠ lista (${totalLista}).`);
      }
      console.log(`Verificação concluída: ${totalMetrica} participação(ões).`);
    });

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
    await fecharDriver(driver);
  }
}

main().catch((erro) => {
  console.error("Erro ao executar o script:", erro);
  process.exit(1);
});
