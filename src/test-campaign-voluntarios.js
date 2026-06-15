/**
 * Helpers partilhados para o separador Voluntários de uma campanha.
 */
const { By, until } = require("selenium-webdriver");

const DEFAULT_DELAY_MS = Number(process.env.TEST_DELAY_MS) || 1200;

async function pausa(driver, ms = DEFAULT_DELAY_MS) {
  await driver.sleep(ms);
}

function xpathLinhaPorEmail(email) {
  return `//table/tbody/tr[.//td[contains(normalize-space(), ${JSON.stringify(email)})]]`;
}

async function aguardarListaVoluntarios(driver) {
  await driver.wait(until.elementLocated(By.xpath("//table/tbody/tr")), 20000);
}

async function aguardarDetalhesCampanha(driver) {
  await driver.wait(async () => {
    const aCarregar = await driver.findElements(
      By.xpath(
        "//*[contains(normalize-space(),'A carregar detalhes') or contains(normalize-space(),'A carregar…')]",
      ),
    );
    return aCarregar.length === 0;
  }, 20000);

  await driver.wait(
    until.elementLocated(By.xpath("//h2[contains(@class,'font-semibold')]")),
    20000,
  );
}

async function abrirSeparadorVoluntarios(driver, baseUrl, campaignId) {
  const url = `${baseUrl}/campanhas/${campaignId}/voluntarios`;
  await driver.get(url);
  await aguardarDetalhesCampanha(driver);

  const painel = await driver.findElements(By.id("campaign-panel-voluntarios"));
  if (painel.length === 0) {
    const tabVoluntarios = await driver.wait(
      until.elementLocated(By.id("campaign-tab-voluntarios")),
      10000,
    );
    await pausa(driver, 400);
    await tabVoluntarios.click();
  }

  await driver.wait(
    until.elementLocated(By.id("campaign-panel-voluntarios")),
    20000,
  );
  await pausa(driver);
}

async function encontrarLinhaVoluntario(driver, { email, nome }) {
  const linha = await driver.wait(
    until.elementLocated(By.xpath(xpathLinhaPorEmail(email))),
    20000,
  );

  if (nome) {
    const texto = (await linha.getText()).trim();
    if (!texto.includes(nome)) {
      throw new Error(
        `Linha do voluntário «${email}» não contém o nome «${nome}»; obtido: «${texto}».`,
      );
    }
  }

  return { linha };
}

function modalInscricao() {
  return By.xpath(
    "//div[@role='dialog'][.//*[@id='edit-registration-title']]",
  );
}

async function escolherOpcaoSelectModal(driver, selectId, textoOpcao) {
  const modal = await driver.findElement(modalInscricao());
  const combobox = await modal.findElement(By.id(selectId));
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

async function fecharDriver(driver) {
  if (!driver) return;
  await pausa(driver, 500);
  await driver.quit();
}

module.exports = {
  abrirSeparadorVoluntarios,
  encontrarLinhaVoluntario,
  xpathLinhaPorEmail,
  aguardarListaVoluntarios,
  escolherOpcaoSelectModal,
  fecharDriver,
};
