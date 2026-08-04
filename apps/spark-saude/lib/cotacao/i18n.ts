/**
 * Idiomas do material que vai para o CLIENTE (mensagem, e-mail e PDF).
 *
 * A interface da corretora continua só em português — quem muda de idioma é a
 * entrega. A carteira da Dani é majoritariamente brasileira, mas ela atende
 * hispanofalantes e americanos, e mandar a proposta no idioma do cliente é a
 * diferença entre ele ler ou não ler.
 *
 * O texto em português é o dela, palavra por palavra (docs/cotacao.md §5) —
 * as traduções seguem o mesmo tom, não uma versão mais formal.
 */

export type Idioma = "pt" | "es" | "en";

export const IDIOMAS: Array<{ value: Idioma; label: string }> = [
  { value: "pt", label: "Português (BR)" },
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
];

export const isIdioma = (v: unknown): v is Idioma => v === "pt" || v === "es" || v === "en";

export interface Dict {
  /** Locale para formatar datas e números na peça. */
  locale: string;
  /** Rótulos de gênero usados no resumo de idades da mensagem. */
  male: string;
  female: string;
  and: string;
  yearsOld: string;
  msg: {
    intro: (year: number) => string;
    household: (n: number, desc: string) => string;
    zip: (zip: string) => string;
    income: (year: number, income: string) => string;
    caveat: string;
  };
  email: {
    subject: (year: number, brand: string) => string;
    hello: (first: string) => string;
    cta: string;
    orCopy: string;
  };
  pdf: {
    title: string;
    subtitle: (year: number) => string;
    preparedFor: (name: string) => string;
    peopleOnPlan: string;
    zipcode: string;
    income: string;
    sideBySide: (n: number) => string;
    colOption: string;
    colPremium: string;
    colDeductible: string;
    colOopMax: string;
    recommended: string;
    creditIncluded: (v: string) => string;
    detailOnPage: (p: number) => string;
    legend: string;
    howToProceed: string;
    step1: string;
    step2: string;
    seeOnline: string;
    /** Rótulo do botão clicável que leva à proposta online. */
    ctaButton: string;
    /** Chamada ao lado do QR code, para quem estiver no computador. */
    scanQr: string;
    detailSection: string;
    option: (n: number) => string;
    recommendedByBroker: string;
    perMonth: string;
    withoutCredit: (v: string) => string;
    creditEstimated: (v: string) => string;
    deductible: string;
    oopMax: string;
    youPayHeading: string;
    rowPrimary: string;
    rowSpecialist: string;
    rowUrgent: string;
    rowEmergency: string;
    rowMental: string;
    rowGeneric: string;
    compareOnPage: (p: number) => string;
    validUntil: (date: string) => string;
    filename: string;
    /** Níveis metálicos, na língua do cliente (o CMS devolve em inglês). */
    metals: Record<string, string>;
    /**
     * Aviso obrigatório de estimativa (docs/cotacao.md §7). Em português vale o
     * texto da marca (configurável para revenda); nos outros idiomas, este.
     */
    disclaimer: string;
  };
}

const money = (v: string) => v;

export const DICTS: Record<Idioma, Dict> = {
  pt: {
    locale: "pt-BR",
    male: "Mas",
    female: "Fem",
    and: "e",
    yearsOld: "anos",
    msg: {
      intro: (year) => `Segue cotações para seguro saúde do Marketplace/Obamacare para ${year}, considerando:`,
      household: (n, desc) =>
        `• ${n === 1 ? "1 pessoa" : `Família de ${n} pessoas`}/Seguro para ${n === 1 ? "1 pessoa" : `${n} pessoas`} (${desc})`,
      zip: (zip) => `• Zipcode: ${zip}`,
      income: (year, income) =>
        `• Renda familiar anual de ${year} estimada a ser declarada no Imposto de Renda em ${year + 1} de ${money(income)}`,
      caveat:
        "*Quando fizermos o seguro provavelmente o valor ficará menor, pois durante a cotação o sistema não reconhece as idades das crianças",
    },
    email: {
      subject: (year, brand) => `Sua cotação de seguro saúde ${year} — ${brand}`,
      hello: (first) => `Olá, ${first} 👋`,
      cta: "Ver minha cotação",
      orCopy: "Ou copie este link:",
    },
    pdf: {
      title: "Proposta de seguro saúde",
      subtitle: (year) => `Marketplace / Obamacare · cobertura ${year}`,
      preparedFor: (name) => `Preparada para ${name}`,
      peopleOnPlan: "Pessoas no plano",
      zipcode: "Zipcode",
      income: "Renda anual declarada",
      sideBySide: (n) => (n === 1 ? "Sua opção" : `Suas ${n} opções, lado a lado`),
      colOption: "OPÇÃO",
      colPremium: "MENSALIDADE",
      colDeductible: "DEDUTÍVEL",
      colOopMax: "MÁX. DO BOLSO",
      recommended: "RECOMENDADA",
      creditIncluded: (v) => `crédito de ${v}/mês`,
      detailOnPage: (p) => `detalhe na pág. ${p}`,
      legend:
        "A mensalidade já considera o crédito fiscal estimado. O dedutível é o valor que você paga antes de o plano começar a dividir os custos; o máximo do bolso é o teto que você gasta no ano.",
      howToProceed: "Como seguir a partir daqui",
      step1: "Cada opção tem sua própria página, com o que você paga em cada atendimento.",
      step2: "Escolheu uma? É só responder esta mensagem — eu cuido da inscrição com você.",
      seeOnline: "Ver online e responder:",
      ctaButton: "Ver minhas opções e responder",
      scanQr: "Ou aponte a câmera do celular para o código",
      detailSection: "Detalhe de cada opção",
      option: (n) => `OPÇÃO ${n}`,
      recommendedByBroker: "· RECOMENDADA PELA CORRETORA",
      perMonth: " /mês",
      withoutCredit: (v) => `Sem o crédito: ${v}`,
      creditEstimated: (v) => `Crédito fiscal estimado: −${v}/mês`,
      deductible: "Dedutível",
      oopMax: "Máximo do bolso",
      youPayHeading: "O QUE VOCÊ PAGA EM CADA ATENDIMENTO",
      rowPrimary: "Atenção primária",
      rowSpecialist: "Atenção de especialista",
      rowUrgent: "Atenção de urgência",
      rowEmergency: "Sala de emergência",
      rowMental: "Saúde mental",
      rowGeneric: "Medicamento genérico",
      compareOnPage: (p) => `Compare com as outras opções na pág. ${p}`,
      validUntil: (date) => `Proposta válida até ${date}`,
      filename: "proposta",
      metals: {
        "Bronze": "Bronze",
        "Expanded Bronze": "Bronze+",
        "Silver": "Prata",
        "Gold": "Ouro",
        "Platinum": "Platina",
        "Catastrophic": "Catastrófico",
      },
      disclaimer:
        "Todos os valores apresentados são estimativas baseadas nas informações declaradas e podem variar na inscrição oficial.",
    },
  },

  es: {
    locale: "es-US",
    male: "Masc",
    female: "Fem",
    and: "y",
    yearsOld: "años",
    msg: {
      intro: (year) => `Le envío las cotizaciones de seguro de salud del Marketplace/Obamacare para ${year}, considerando:`,
      household: (n, desc) =>
        `• ${n === 1 ? "1 persona" : `Familia de ${n} personas`}/Seguro para ${n === 1 ? "1 persona" : `${n} personas`} (${desc})`,
      zip: (zip) => `• Código postal: ${zip}`,
      income: (year, income) =>
        `• Ingreso familiar anual de ${year} estimado a declarar en los impuestos de ${year + 1}: ${money(income)}`,
      caveat:
        "*Cuando hagamos el seguro probablemente el valor sea menor, porque durante la cotización el sistema no reconoce las edades de los niños",
    },
    email: {
      subject: (year, brand) => `Su cotización de seguro de salud ${year} — ${brand}`,
      hello: (first) => `Hola, ${first} 👋`,
      cta: "Ver mi cotización",
      orCopy: "O copie este enlace:",
    },
    pdf: {
      title: "Propuesta de seguro de salud",
      subtitle: (year) => `Marketplace / Obamacare · cobertura ${year}`,
      preparedFor: (name) => `Preparada para ${name}`,
      peopleOnPlan: "Personas en el plan",
      zipcode: "Código postal",
      income: "Ingreso anual declarado",
      sideBySide: (n) => (n === 1 ? "Su opción" : `Sus ${n} opciones, lado a lado`),
      colOption: "OPCIÓN",
      colPremium: "PRIMA MENSUAL",
      colDeductible: "DEDUCIBLE",
      colOopMax: "MÁX. BOLSILLO",
      recommended: "RECOMENDADA",
      creditIncluded: (v) => `crédito de ${v}/mes`,
      detailOnPage: (p) => `detalle en pág. ${p}`,
      legend:
        "La prima ya considera el crédito fiscal estimado. El deducible es lo que usted paga antes de que el plan empiece a compartir los costos; el máximo de bolsillo es el tope que usted gasta en el año.",
      howToProceed: "Cómo seguir desde aquí",
      step1: "Cada opción tiene su propia página, con lo que usted paga en cada atención.",
      step2: "¿Eligió una? Solo responda este mensaje — yo me encargo de la inscripción con usted.",
      seeOnline: "Ver en línea y responder:",
      ctaButton: "Ver mis opciones y responder",
      scanQr: "O apunte la cámara del celular al código",
      detailSection: "Detalle de cada opción",
      option: (n) => `OPCIÓN ${n}`,
      recommendedByBroker: "· RECOMENDADA POR LA AGENTE",
      perMonth: " /mes",
      withoutCredit: (v) => `Sin el crédito: ${v}`,
      creditEstimated: (v) => `Crédito fiscal estimado: −${v}/mes`,
      deductible: "Deducible",
      oopMax: "Máximo de bolsillo",
      youPayHeading: "LO QUE USTED PAGA EN CADA ATENCIÓN",
      rowPrimary: "Atención primaria",
      rowSpecialist: "Atención de especialista",
      rowUrgent: "Atención de urgencia",
      rowEmergency: "Sala de emergencias",
      rowMental: "Salud mental",
      rowGeneric: "Medicamento genérico",
      compareOnPage: (p) => `Compare con las otras opciones en pág. ${p}`,
      validUntil: (date) => `Propuesta válida hasta ${date}`,
      filename: "propuesta",
      metals: {
        "Bronze": "Bronce",
        "Expanded Bronze": "Bronce+",
        "Silver": "Plata",
        "Gold": "Oro",
        "Platinum": "Platino",
        "Catastrophic": "Catastrófico",
      },
      disclaimer:
        "Todos los valores presentados son estimaciones basadas en la información declarada y pueden variar en la inscripción oficial.",
    },
  },

  en: {
    locale: "en-US",
    male: "Male",
    female: "Female",
    and: "and",
    yearsOld: "yrs",
    msg: {
      intro: (year) => `Here are your Marketplace/Obamacare health insurance quotes for ${year}, based on:`,
      household: (n, desc) =>
        `• ${n === 1 ? "1 person" : `Household of ${n} people`}/Coverage for ${n === 1 ? "1 person" : `${n} people`} (${desc})`,
      zip: (zip) => `• Zip code: ${zip}`,
      income: (year, income) =>
        `• Estimated ${year} household income to be reported on the ${year + 1} tax return: ${money(income)}`,
      caveat:
        "*The final amount will likely be lower — during the quote the system does not account for the children's exact ages",
    },
    email: {
      subject: (year, brand) => `Your ${year} health insurance quote — ${brand}`,
      hello: (first) => `Hi ${first} 👋`,
      cta: "View my quote",
      orCopy: "Or copy this link:",
    },
    pdf: {
      title: "Health insurance proposal",
      subtitle: (year) => `Marketplace / Obamacare · ${year} coverage`,
      preparedFor: (name) => `Prepared for ${name}`,
      peopleOnPlan: "People on the plan",
      zipcode: "Zip code",
      income: "Reported annual income",
      sideBySide: (n) => (n === 1 ? "Your option" : `Your ${n} options, side by side`),
      colOption: "OPTION",
      colPremium: "MONTHLY PREMIUM",
      colDeductible: "DEDUCTIBLE",
      colOopMax: "MAX. YOU PAY",
      recommended: "RECOMMENDED",
      creditIncluded: (v) => `${v}/mo credit`,
      detailOnPage: (p) => `details on p. ${p}`,
      legend:
        "The premium already includes the estimated tax credit. The deductible is what you pay before the plan starts sharing costs; the out-of-pocket maximum is the most you can spend in a year.",
      howToProceed: "What happens next",
      step1: "Each option has its own page, with what you pay for every kind of visit.",
      step2: "Found the one? Just reply to this message — I'll handle the enrollment with you.",
      seeOnline: "View online and reply:",
      ctaButton: "See my options and reply",
      scanQr: "Or point your phone camera at the code",
      detailSection: "Each option in detail",
      option: (n) => `OPTION ${n}`,
      recommendedByBroker: "· RECOMMENDED BY YOUR AGENT",
      perMonth: " /mo",
      withoutCredit: (v) => `Without the credit: ${v}`,
      creditEstimated: (v) => `Estimated tax credit: −${v}/mo`,
      deductible: "Deductible",
      oopMax: "Out-of-pocket max",
      youPayHeading: "WHAT YOU PAY FOR EACH VISIT",
      rowPrimary: "Primary care",
      rowSpecialist: "Specialist visit",
      rowUrgent: "Urgent care",
      rowEmergency: "Emergency room",
      rowMental: "Mental health",
      rowGeneric: "Generic drugs",
      compareOnPage: (p) => `Compare with the other options on p. ${p}`,
      validUntil: (date) => `Proposal valid through ${date}`,
      filename: "proposal",
      metals: {
        "Bronze": "Bronze",
        "Expanded Bronze": "Bronze+",
        "Silver": "Silver",
        "Gold": "Gold",
        "Platinum": "Platinum",
        "Catastrophic": "Catastrophic",
      },
      disclaimer:
        "All amounts shown are estimates based on the information provided and may change at official enrollment.",
    },
  },
};

export const dict = (idioma?: Idioma | null): Dict => DICTS[idioma && isIdioma(idioma) ? idioma : "pt"];
