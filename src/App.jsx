export default function App() {
  return (
    <div className="min-h-screen relative overflow-hidden text-white">

      {/* Fundo */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://i.imgur.com/pKx1Cvd.png')",
        }}
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Conteúdo */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center">

        {/* Logo */}
        <img
          src="https://i.imgur.com/DYQY9IR.png"
          alt="Grand Line RPG"
          className="w-full max-w-3xl drop-shadow-2xl"
        />

        {/* Texto */}
        <p className="mt-8 text-xl md:text-2xl text-yellow-100 max-w-3xl leading-relaxed">
          Viva sua própria aventura no Novo Mundo.
          Recrute sua tripulação, enfrente inimigos
          lendários e torne-se o Rei dos Piratas.
        </p>

        {/* Botão */}
        <button className="mt-10 px-10 py-5 text-2xl font-bold rounded-2xl border-4 border-yellow-600 bg-red-900 hover:scale-105 transition">
          ⚓ COMEÇAR JORNADA
        </button>

      </div>
    </div>
  )
}
