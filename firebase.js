// ======================
// FIREBASE IMPORTS
// ======================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
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

async function iniciarFirebase(){
  await setPersistence(
    auth,
    browserLocalPersistence
  );

  // Inicializa ReCAPTCHA invisível do Firebase
  window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
    'size': 'invisible',
    'callback': () => {}
  });
}

iniciarFirebase();

// Auxiliar para formatar número para padrão internacional (+55...)
function formatPhoneNumber(phone) {
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  return '+' + cleaned;
}

// Auxiliar para converter o celular em identificador interno de Auth
function phoneToAuthEmail(phone) {
  const cleaned = phone.replace(/\D/g, '');
  return `${cleaned}@grandlinerpg.com`;
}

// ======================
// REGISTRO - ETAPA 1: ENVIAR SMS
// ======================
window.sendRegisterSMS = async function () {
  const phone = document.getElementById("register-phone").value;
  const nome = document.getElementById("register-name").value;
  const senha = document.getElementById("register-password").value;
  const confirmar = document.getElementById("register-confirm").value;

  if (!phone || !nome || !senha || !confirmar) {
    alert("Preencha todos os campos antes de enviar o SMS!");
    return;
  }

  if (senha !== confirmar) {
    alert("As senhas não coincidem!");
    return;
  }

  const formattedPhone = formatPhoneNumber(phone);
  const appVerifier = window.recaptchaVerifier;

  try {
    const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
    confirmationResultGlobal = confirmationResult;

    alert("Código SMS enviado para " + formattedPhone);

    // Exibe o campo para inserir o código do SMS
    document.getElementById("sms-group").classList.remove("hidden");
    document.getElementById("btn-confirm-register").classList.remove("hidden");
    document.getElementById("btn-send-sms").classList.add("hidden");

  } catch (error) {
    console.error("Erro ao enviar SMS:", error);
    alert("Falha ao enviar SMS: " + error.message);
  }
};

// ======================
// REGISTRO - ETAPA 2: VALIDAR SMS E REGISTRAR CONTA/SENHA
// ======================
window.register = async function () {
  const smsCode = document.getElementById("register-sms-code").value;
  const phone = document.getElementById("register-phone").value;
  const senha = document.getElementById("register-password").value;
  const nome = document.getElementById("register-name").value;

  if (!smsCode) {
    alert("Digite o código SMS recebido!");
    return;
  }

  try {
    // 1. Confirma que o número de telefone é real e pertence ao usuário
    await confirmationResultGlobal.confirm(smsCode);

    // 2. Cria a conta permanente com celular + senha
    const authEmail = phoneToAuthEmail(phone);
    const userCredential = await createUserWithEmailAndPassword(auth, authEmail, senha);
    const user = userCredential.user;

    const playerData = {
      uid: user.uid,
      nome: nome,
      celular: formatPhoneNumber(phone),

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

    alert("Celular verificado e conta criada com sucesso!");
    window.location.href = "auth.html";

  } catch (error) {
    console.error("Erro no cadastro:", error);
    alert("Erro na verificação do código ou no cadastro: " + error.message);
  }
};

// ======================
// LOGIN (CELULAR + SENHA)
// ======================
window.login = async function () {
  const phone = document.getElementById("login-phone").value;
  const senha = document.getElementById("login-password").value;

  if (!phone || !senha) {
    alert("Preencha todos os campos!");
    return;
  }

  const authEmail = phoneToAuthEmail(phone);

  try {
    const userCredential = await signInWithEmailAndPassword(auth, authEmail, senha);
    const user = userCredential.user;

    localStorage.setItem("uid", user.uid);

    // BUSCA DADOS DO PLAYER
    const snap = await get(ref(db, `players/${user.uid}`));

    if (!snap.exists()) {
      alert("Jogador não encontrado!");
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
    alert("Erro ao realizar login: " + error.message);
  }
};
