// Preguntas del Dúo. `hint` sugiere el formato, pero cualquier formato es válido.
export const PROMPTS = [
  { id: 'p01', text: '¿Qué canción describe tu día hasta ahora?', hint: 'audio' },
  { id: 'p02', text: 'Lo mejor que has comido hoy', hint: 'photo' },
  { id: 'p03', text: 'Una cosa pequeña que te hizo sonreír', hint: 'text' },
  { id: 'p04', text: 'Enséñame lo que tienes delante ahora mismo', hint: 'photo' },
  { id: 'p05', text: 'Una opinión impopular que defiendes sin miedo', hint: 'text' },
  { id: 'p06', text: 'Cuéntame en 20 segundos qué te tiene ocupado', hint: 'audio' },
  { id: 'p07', text: 'El sonido de donde estás ahora', hint: 'audio' },
  { id: 'p08', text: '¿Qué te gustaría estar haciendo en este momento?', hint: 'text' },
  { id: 'p09', text: 'Algo que te recuerde a mí', hint: 'photo' },
  { id: 'p10', text: 'Una palabra para tu semana. Solo una.', hint: 'text' },
  { id: 'p11', text: 'Tu cielo de hoy', hint: 'photo' },
  { id: 'p12', text: 'Lo último que te hizo reír de verdad', hint: 'text' },
  { id: 'p13', text: 'Un plan que deberíamos hacer juntos', hint: 'text' },
  { id: 'p14', text: 'Algo que aprendiste esta semana', hint: 'audio' },
  { id: 'p15', text: 'Tu rincón favorito de tu casa', hint: 'photo' },
  { id: 'p16', text: 'Si hoy fuera una película, ¿cómo se llamaría?', hint: 'text' },
  { id: 'p17', text: 'Un consejo que te darías hace un año', hint: 'audio' },
  { id: 'p18', text: '¿Qué estás escuchando en bucle?', hint: 'text' },
  { id: 'p19', text: 'Un objeto que llevas siempre encima', hint: 'photo' },
  { id: 'p20', text: 'Algo que te pone nervioso y te ilusiona a la vez', hint: 'text' },
  { id: 'p21', text: 'Tu reacción honesta a este lunes (o al día que sea)', hint: 'audio' },
  { id: 'p22', text: 'Un recuerdo random que te vino hoy', hint: 'text' },
  { id: 'p23', text: 'Tus zapatillas ahora mismo', hint: 'photo' },
  { id: 'p24', text: 'Algo que te gustaría que te preguntaran más', hint: 'text' },
  { id: 'p25', text: 'Imita tu sonido favorito', hint: 'audio' },
  { id: 'p26', text: 'La última foto que hiciste que no subirías a ningún sitio', hint: 'photo' },
  { id: 'p27', text: '¿Qué te ha salido bien hoy?', hint: 'text' },
  { id: 'p28', text: 'Recomiéndame algo en 15 segundos', hint: 'audio' },
  { id: 'p29', text: 'El color de tu día y por qué', hint: 'text' },
  { id: 'p30', text: 'Algo que ves cada día y nadie más se fija', hint: 'photo' },
];

export const promptById = (id) => PROMPTS.find((p) => p.id === id) || { id, text: 'Pregunta del día', hint: 'text' };

// Respuestas de las cuentas demo (solo se usan cuando el compañero es una cuenta demo).
export const DEMO_ANSWERS = [
  'Ni te imaginas. Te lo cuento luego 👀',
  'Hoy todo me sabe a viernes aunque no lo sea',
  'Honestamente: un café a tiempo me salvó el día',
  'Esta pregunta me ha pillado en el bus, así que: ventanilla y cascos',
  'Algo pequeño pero bonito, como esta app jaja',
];
