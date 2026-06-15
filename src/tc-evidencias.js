/**
 * Helper partilhado: screenshot sequencial por passo em evidencias/<TESTE_ID>/.
 *
 * Passos de login/autenticação não geram screenshot, excepto no RF01
 * (Autenticar utilizadores), onde o login é o objecto do teste.
 */
const fs = require("fs");
const path = require("path");

const TESTE_RF1_ID = "RF01";

function isPassoAutenticacao(slug, descricao) {
  const s = String(slug || "").toLowerCase();
  const d = String(descricao || "").toLowerCase();

  if (/(^|_)login|logout|entrar|sessao|sessão/.test(s)) return true;
  if (/login|logout|entrar|terminar sess/.test(d)) return true;
  if (/p[aá]gina de login/.test(d) || s.includes("pagina_login")) return true;

  return false;
}

const EVIDENCIAS_ROOT = path.join(__dirname, "..", "evidencias");

function createEvidencias(testeId) {
  const pasta = path.join(EVIDENCIAS_ROOT, testeId);
  let counter = 0;

  async function executarPasso(driver, num, descricao, slug, acao, opts = {}) {
    console.log(`[PASSO ${num}] ${descricao}`);
    if (acao) await acao();

    const capturar =
      opts.capturar !== false &&
      (testeId === TESTE_RF1_ID || !isPassoAutenticacao(slug, descricao));

    if (!capturar) {
      console.log("[SKIP] Screenshot omitido (passo de autenticação).");
      return null;
    }

    counter++;
    fs.mkdirSync(pasta, { recursive: true });
    const ficheiro = path.join(
      pasta,
      `${String(counter).padStart(2, "0")}_passo${String(num).padStart(2, "0")}_${slug}.png`,
    );
    fs.writeFileSync(ficheiro, await driver.takeScreenshot(), "base64");
    console.log(`[OK] Screenshot: ${ficheiro}`);
    return ficheiro;
  }

  async function screenshotErro(driver) {
    fs.mkdirSync(pasta, { recursive: true });
    const ficheiro = path.join(pasta, `ERRO_${Date.now()}.png`);
    fs.writeFileSync(ficheiro, await driver.takeScreenshot(), "base64");
    console.log(`[ERRO] Screenshot: ${ficheiro}`);
    return ficheiro;
  }

  return { executarPasso, screenshotErro, pasta };
}

module.exports = { createEvidencias, EVIDENCIAS_ROOT };
