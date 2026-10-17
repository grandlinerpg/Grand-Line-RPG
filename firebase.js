// ======================
// FIREBASE IMPORTS
// ======================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getDatabase,
  ref,
  set,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ======================
// CONFIG
// ======================
const firebaseConfig = {
  apiKey: "AIzaSyC4kgy_L79WYFqr9XZhoDuZBfqG4AGTVUQ",
  authDomain: "grand-line-rpg-dcda9.firebaseapp.com",
  projectId: "grand-line-rpg-dcda9",
  storageBucket: "grand-line-rpg-dcda9.appspot.com",
  messagingSenderId: "172042779786",
  appId: "1:172042779786:web:ecdff9eaf4fee36eca8173",
  databaseURL: "https://grand-line-rpg-dcda9-default-rtdb.firebaseio.com"
};

// ======================
// INIT
// ======================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let confirmationResultGlobal = null;

async function iniciarFirebase() {
  await setPersistence(auth, browserLocalPersistence);
  
  // Configuração do ReCAPTCHA invisível do Firebase
  window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
    'size': 'invisible',
    'callback': () => {
      // reCAPTCHA resolvido
    }
  });
}

iniciarFirebase();

// Helper para formatar o número no padrão E.164 (+55DDDNÚMERO)
function formatPhoneNumber(phone) {
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  return '+' + cleaned;
}

// ======================
// REGISTRO - ETAPA 1: ENVIAR SMS
// ======================
window.sendRegisterCode = async function () {
  const phoneInput = document.getElementById("register-phone").value;
  const nome = document.getElementById("register-name").value;

  if (!phoneInput || !nome) {
    alert("Preencha o nome e o celular!");
    return;
  }

  const formattedPhone = formatPhoneNumber(phoneInput);
  const appVerifier = window.recaptchaVerifier;

  try {
    const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
    confirmationResultGlobal = confirmationResult;

    alert("Código SMS enviado para " + formattedPhone);

    // Exibe o campo de digitação do código SMS
    document.getElementById("register-code-group").classList.remove("hidden");
    document.getElementById("btn-verify-reg-code").classList.remove("hidden");
    document.getElementById("btn-send-reg-code").classList.add("hidden");

  } catch (error) {
    console.error("Erro ao enviar SMS:", error);
    alert("Falha ao enviar SMS: " + error.message);
  }
};

// ======================
// REGISTRO - ETAPA 2: VALIDAR CÓDIGO E SALVAR NO BANCO
// ======================
window.verifyRegisterCode = async function () {
  const code = document.getElementById("register-code").value;
  const nome = document.getElementById("register-name").value;
  const phoneInput = document.getElementById("register-phone").value;

  if (!code) {
    alert("Digite o código recebido por SMS!");
    return;
  }

  try {
    const result = await confirmationResultGlobal.confirm(code);
    const user = result.user;

    const playerData = {
      uid: user.uid,
      nome: nome,
      celular: formatPhoneNumber(phoneInput),

      info: {
        level: 1,
        exp: 0,
        saldo: 10000
      },

      character: {
        faction: "Governo Mundial",
        ilha: "0",
        status: "Parado",
        charName: "Sem Personagem",
        style: "—",
        race: "Humano",
        rank: "1",
        fruit: "—"
      },

      inventory: {
        trocadepersonagem: 1
      },

      skills: {
        Esquiva: {
          categoria: "Disponíveis",
          sub: "Básicas"
        }
      },

      stats: {
        str: 1,
        res: 1,
        dex: 1,
        agi: 1,
        sta: 1,
        hp: 1
      },

      points: {
        available: 10,
        "skill-available": 1,
        "skill-used": 1,
        used: 0
      }
    };

    await set(ref(db, `players/${user.uid}`), playerData);

    alert("Conta criada com sucesso!");
    window.location.href = "auth.html";

  } catch (error) {
    console.error("Erro na verificação do código:", error);
    alert("Código inválido ou expirado!");
  }
};

// ======================
// LOGIN - ETAPA 1: ENVIAR SMS
// ======================
window.sendLoginCode = async function () {
  const phoneInput = document.getElementById("login-phone").value;

  if (!phoneInput) {
    alert("Informe o número de celular!");
    return;
  }

  const formattedPhone = formatPhoneNumber(phoneInput);
  const appVerifier = window.recaptchaVerifier;

  try {
    const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
    confirmationResultGlobal = confirmationResult;

    alert("Código SMS enviado para " + formattedPhone);

    // Exibe o campo de digitação do código SMS
    document.getElementById("login-code-group").classList.remove("hidden");
    document.getElementById("btn-verify-login-code").classList.remove("hidden");
    document.getElementById("btn-send-login-code").classList.add("hidden");

  } catch (error) {
    console.error("Erro ao enviar SMS:", error);
    alert("Falha ao enviar SMS: " + error.message);
  }
};

// ======================
// LOGIN - ETAPA 2: VALIDAR CÓDIGO E REDIRECIONAR
// ======================
window.verifyLoginCode = async function () {
  const code = document.getElementById("login-code").value;

  if (!code) {
    alert("Digite o código recebido por SMS!");
    return;
  }

  try {
    const result = await confirmationResultGlobal.confirm(code);
    const user = result.user;

    localStorage.setItem("uid", user.uid);

    // BUSCA DADOS DO PLAYER NO BANCO
    const snap = await get(ref(db, `players/${user.uid}`));

    if (!snap.exists()) {
      alert("Jogador não encontrado na base de dados!");
      return;
    }

    const data = snap.val();

    // CHECA SE TEM PERSONAGEM
    const temPersonagem =
      data.character &&
      data.character.charName &&
      data.character.charName !== "Sem Personagem";

    if (temPersonagem) {
      window.location.href = "perfil.html";
    } else {
      window.location.href = "selecao-de-personagem.html";
    }

  } catch (error) {
    console.error("Erro na verificação do código:", error);
    alert("Código inválido ou expirado!");
  }
};
