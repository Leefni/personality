export const RESULT_CONTENT = {
  dimensions: {
    EI: {
      poles: ['E', 'I'],
      names: ['Extraversie', 'Introversie']
    },
    SN: {
      poles: ['S', 'N'],
      names: ['Waarnemen', 'Intuïtie']
    },
    TF: {
      poles: ['T', 'F'],
      names: ['Denken', 'Voelen']
    },
    JP: {
      poles: ['J', 'P'],
      names: ['Oordelend', 'Percipiërend']
    }
  },
  types: {
    ESTJ: {
      shortDescription: 'Praktische organisator die structuur en verantwoordelijkheid omarmt.',
      longDescriptionNl: 'Je brengt snel orde in complexe situaties en neemt vanzelf verantwoordelijkheid voor het resultaat. Mensen vertrouwen op je omdat je duidelijkheid schept en afspraken bewaakt.',
      werkstijlNl: 'Je floreert met heldere doelen, vaste processen en duidelijke bevoegdheden. Je pakt graag de regie zodra rollen of prioriteiten onduidelijk zijn.',
      valkuilenNl: 'Je kunt streng of ongeduldig worden als anderen trager beslissen of afwijken van de afspraak. Daardoor kan vernieuwing te weinig ruimte krijgen.',
      groeitipsNl: 'Plan bij grote besluiten bewust een korte ronde voor alternatieven. Oefen met vragen stellen vóór je een richting vastlegt.',
      strengths: ['Besluitvaardig', 'Betrouwbaar', 'Sterk in plannen'],
      attentionPoints: ['Kan star overkomen', 'Minder geduld met vaagheid'],
      tips: ['Plan bewust rustmomenten in', 'Vraag actief om alternatieve ideeën']
    },
    ESTP: {
      shortDescription: 'Energieke doener die kansen ziet en direct in actie komt.',
      longDescriptionNl: 'Je leert door te doen en ziet razendsnel waar kansen liggen in het moment. Met je lef en improvisatievermogen krijg je beweging in stroperige situaties.',
      werkstijlNl: 'Je werkt het sterkst in dynamische omgevingen met directe feedback en zichtbare resultaten. Vrijheid om te experimenteren houdt je scherp en betrokken.',
      valkuilenNl: 'Je kunt risico’s onderschatten wanneer iets spannend of kansrijk voelt. Langlopende afspraken verliezen dan sneller je aandacht.',
      groeitipsNl: 'Bouw korte reflectiestops in voordat je beslist. Leg per week één langetermijndoel vast en toets je acties daaraan.',
      strengths: ['Snel schakelen', 'Pragmatisch', 'Sociaal overtuigend'],
      attentionPoints: ['Neiging tot impulsiviteit', 'Minder focus op lange termijn'],
      tips: ['Check eerst risico’s', 'Werk met korte evaluatiemomenten']
    },
    ESFJ: {
      shortDescription: 'Betrokken verbinder die harmonie en samenwerking stimuleert.',
      longDescriptionNl: 'Je voelt goed aan wat mensen nodig hebben en bouwt actief aan een veilige samenwerking. Je combineert warmte met praktische zorg, waardoor teams betrouwbaar draaien.',
      werkstijlNl: 'Je komt tot je recht in een voorspelbaar teamritme met duidelijke verwachtingen. Je bent op je best wanneer waardering en onderlinge afstemming zichtbaar zijn.',
      valkuilenNl: 'Je kunt jezelf wegcijferen om de sfeer goed te houden. Spanningen blijven dan te lang onder tafel, met frustratie als gevolg.',
      groeitipsNl: 'Benoem je eigen grenzen vroeg en concreet. Oefen met directe feedback geven, ook als dat even ongemakkelijk voelt.',
      strengths: ['Empathisch', 'Loyaal', 'Sterk in teamdynamiek'],
      attentionPoints: ['Kan te veel pleasen', 'Neemt kritiek persoonlijk op'],
      tips: ['Stel heldere grenzen', 'Plan reflectie in op eigen behoeften']
    },
    ESFP: {
      shortDescription: 'Enthousiaste sfeermaker die graag in het moment leeft.',
      longDescriptionNl: 'Je brengt energie, spontaniteit en menselijkheid in elke groep. Met je observatie van het hier-en-nu maak je snel contact en zet je ideeën om in actie.',
      werkstijlNl: 'Je presteert goed in afwisselend werk met ruimte voor interactie en zichtbare impact. Korte doelen werken beter voor je dan starre langetermijnplannen.',
      valkuilenNl: 'Routine en administratieve details kunnen je motivatie snel laten dalen. Daardoor stel je lastige taken soms te lang uit.',
      groeitipsNl: 'Knip saaie taken op in kleine blokken met duidelijke eindpunten. Gebruik een vaste weekstart om prioriteiten en deadlines te bewaken.',
      strengths: ['Positieve energie', 'Flexibel', 'Praktisch creatief'],
      attentionPoints: ['Moeite met routine', 'Vermijdt soms moeilijke keuzes'],
      tips: ['Gebruik reminders voor structuur', 'Vertaal doelen naar korte acties']
    },
    ENTJ: {
      shortDescription: 'Strategische leider die richting geeft en resultaten nastreeft.',
      longDescriptionNl: 'Je denkt in strategie, schaal en resultaat en stuurt doelgericht op vooruitgang. Je neemt makkelijk leiding wanneer richting of tempo ontbreekt.',
      werkstijlNl: 'Je functioneert optimaal met ambitieuze doelen, autonomie en beslisruimte. Je combineert graag lange lijnen met meetbare tussenstappen.',
      valkuilenNl: 'Je kunt te snel over gevoelens of draagvlak heenstappen als de druk hoog is. Dat kan weerstand oproepen, ook bij sterke plannen.',
      groeitipsNl: 'Check bij besluiten expliciet wat het effect op mensen is. Maak ruimte voor tegenspraak voordat je knopen doorhakt.',
      strengths: ['Visiegericht', 'Doelgericht', 'Sterk in organiseren'],
      attentionPoints: ['Kan dominant overkomen', 'Soms te weinig ruimte voor gevoel'],
      tips: ['Luister actief vóór besluiten', 'Beloon ook proces, niet alleen resultaat']
    },
    ENTP: {
      shortDescription: 'Inventieve uitdager die nieuwe ideeën en mogelijkheden verkent.',
      longDescriptionNl: 'Je bruist van ideeën en ziet patronen die anderen missen. Met je scherpe vragen daag je teams uit om slimmer en origineler te denken.',
      werkstijlNl: 'Je werkt graag in omgevingen waar debat, vernieuwing en experiment welkom zijn. Vrijheid in aanpak geeft je de meeste creativiteit.',
      valkuilenNl: 'Je verliest soms interesse zodra de uitvoering veel herhaling vraagt. Dan blijven goede concepten half af.',
      groeitipsNl: 'Kies per project vooraf wat “klaar” betekent. Koppel je ideeën aan vaste oplevermomenten en laat iemand meekijken op voortgang.',
      strengths: ['Innovatief', 'Scherp analyserend', 'Snel lerend'],
      attentionPoints: ['Verliest interesse in details', 'Start meer dan hij afrondt'],
      tips: ['Werk met concrete deadlines', 'Kies per project één focusdoel']
    },
    ENFJ: {
      shortDescription: 'Inspirerende motivator die mensen in beweging brengt.',
      longDescriptionNl: 'Je verbindt visie aan mensen en krijgt groepen in beweging rond een gedeeld doel. Je communiceert warm én richtinggevend, waardoor anderen zich gezien voelen.',
      werkstijlNl: 'Je bent op je best in rollen met coaching, afstemming en ontwikkelruimte. Duidelijke waarden en gezamenlijk commitment geven je extra motivatie.',
      valkuilenNl: 'Je kunt te veel verantwoordelijkheid voelen voor het welzijn van iedereen. Daardoor raak je sneller overbelast of stel je lastige keuzes uit.',
      groeitipsNl: 'Bepaal vooraf welke taken echt van jou zijn. Plan structureel herstelmomenten en bewaak die net zo serieus als afspraken.',
      strengths: ['Coachend', 'Communicatief sterk', 'Waarde-gedreven'],
      attentionPoints: ['Kan zichzelf wegcijferen', 'Neiging tot oververantwoordelijkheid'],
      tips: ['Delegeer bewust', 'Reserveer tijd voor eigen herstel']
    },
    ENFP: {
      shortDescription: 'Creatieve vernieuwer die kansen ziet in mensen en ideeën.',
      longDescriptionNl: 'Je ziet potentieel in ideeën en mensen en brengt enthousiasme mee dat aanstekelijk werkt. Je denkt associatief en legt verrassende verbanden.',
      werkstijlNl: 'Je floreert in creatieve contexten met vrijheid, variatie en betekenis. Samenwerken met ruimte voor eigen invulling houdt je betrokken.',
      valkuilenNl: 'Je aandacht kan versnipperen wanneer er te veel opties tegelijk openstaan. Dan worden keuzes en afronding lastig.',
      groeitipsNl: 'Beperk actieve projecten bewust tot een klein aantal. Sluit elke dag af met één concrete volgende stap per prioriteit.',
      strengths: ['Enthousiast', 'Origineel', 'Empathisch verbindend'],
      attentionPoints: ['Snel afgeleid', 'Moeite met strakke systemen'],
      tips: ['Gebruik visuele planning', 'Rond eerst af, start daarna iets nieuws']
    },
    ISTJ: {
      shortDescription: 'Nauwkeurige bouwer die stabiliteit en kwaliteit bewaakt.',
      longDescriptionNl: 'Je bent zorgvuldig, plichtsgetrouw en sterk in het borgen van kwaliteit. Door je betrouwbaarheid worden processen stabiel en voorspelbaar.',
      werkstijlNl: 'Je werkt prettig met duidelijke standaarden, planning en heldere verantwoordelijkheden. Voorbereiding vooraf helpt je om efficiënt te leveren.',
      valkuilenNl: 'Plotselinge veranderingen kunnen je tempo of vertrouwen verstoren. Je kunt dan te lang vasthouden aan de bekende route.',
      groeitipsNl: 'Oefen met kleine experimenten binnen veilige kaders. Vraag actief naar de reden achter verandering om sneller mee te bewegen.',
      strengths: ['Consistent', 'Verantwoordelijk', 'Detailgericht'],
      attentionPoints: ['Kan behoudend zijn', 'Moeite met plotselinge verandering'],
      tips: ['Plan ruimte voor experiment', 'Benoem expliciet je flexibiliteit']
    },
    ISTP: {
      shortDescription: 'Rustige probleemoplosser die techniek en logica combineert.',
      longDescriptionNl: 'Je ontleedt problemen koel en praktisch, en vindt vaak elegante oplossingen. Je houdt van vakmanschap en leert snel door te testen.',
      werkstijlNl: 'Je werkt het liefst zelfstandig met duidelijke technische uitdagingen en weinig ruis. Vrijheid in methode is voor jou belangrijker dan veel overleg.',
      valkuilenNl: 'Je kunt afstandelijk overkomen omdat je intern afweegt voordat je iets deelt. Teamleden missen dan soms je redenering of intentie.',
      groeitipsNl: 'Maak je denkstappen tussentijds zichtbaar, ook als ze nog niet af zijn. Spreek verwachtingen expliciet af om misverstanden te voorkomen.',
      strengths: ['Analytisch', 'Praktisch', 'Kalm onder druk'],
      attentionPoints: ['Houdt afstand in communicatie', 'Stelt beslissingen soms uit'],
      tips: ['Maak verwachtingen expliciet', 'Deel tussentijds je voortgang']
    },
    ISFJ: {
      shortDescription: 'Zorgzame ondersteuner die aandacht heeft voor detail en mensen.',
      longDescriptionNl: 'Je ondersteunt anderen met toewijding en oog voor wat praktisch nodig is. Dankzij je zorgvuldigheid voelen mensen zich gezien en geholpen.',
      werkstijlNl: 'Je functioneert sterk in een stabiele omgeving met duidelijke afspraken en betrouwbare relaties. Je combineert nauwkeurigheid met betrokkenheid.',
      valkuilenNl: 'Je neemt gemakkelijk te veel taken over om anderen te ontlasten. Daardoor raken je eigen grenzen op de achtergrond.',
      groeitipsNl: 'Maak je belasting zichtbaar en bespreek tijdig wat haalbaar is. Oefen met vriendelijk nee zeggen zonder je te verontschuldigen.',
      strengths: ['Betrouwbaar', 'Geduldig', 'Dienstbaar'],
      attentionPoints: ['Vermijdt conflict', 'Neemt te veel op zich'],
      tips: ['Zeg vaker tijdig nee', 'Plan vaste momenten voor feedback']
    },
    ISFP: {
      shortDescription: 'Gevoelige maker die authenticiteit en vrijheid belangrijk vindt.',
      longDescriptionNl: 'Je bent gevoelig voor sfeer en werkt vanuit persoonlijke waarden en esthetiek. Je brengt creativiteit en oprechte aandacht in wat je maakt.',
      werkstijlNl: 'Je presteert het best met autonomie, rustige focus en ruimte voor een eigen aanpak. Praktische taken gaan makkelijker als ze betekenis voor je hebben.',
      valkuilenNl: 'Je kunt conflicten mijden en belangrijke zorgen te lang inslikken. Daardoor ontstaat onduidelijkheid over wat je nodig hebt.',
      groeitipsNl: 'Spreek wensen en grenzen vroeg uit in concrete taal. Gebruik lichte structuur om prioriteiten vast te houden zonder je vrijheid te verliezen.',
      strengths: ['Empathisch', 'Creatief', 'Flexibel'],
      attentionPoints: ['Mijdt strakke planning', 'Houdt zorgen voor zich'],
      tips: ['Werk met zachte deadlines', 'Spreek behoeften eerder uit']
    },
    INTJ: {
      shortDescription: 'Conceptuele strateeg die lange-termijnplannen scherp uitwerkt.',
      longDescriptionNl: 'Je denkt strategisch vooruit en vertaalt complexe vraagstukken naar heldere systemen. Je zoekt diepgang en werkt het liefst aan structurele verbeteringen.',
      werkstijlNl: 'Je werkt sterk met autonomie, intellectuele uitdaging en lange focusblokken. Duidelijke doelen zonder micromanagement geven je ruimte om te excelleren.',
      valkuilenNl: 'Je kunt kritisch of afstandelijk overkomen als argumenten niet scherp zijn. Daardoor kan samenwerking stroef worden, zelfs met goede intenties.',
      groeitipsNl: 'Leg vaker uit hoe je tot conclusies komt, niet alleen wat je besluit. Plan bewust momenten om draagvlak en gevoelens te peilen.',
      strengths: ['Onafhankelijk', 'Visionair', 'Sterk analyserend'],
      attentionPoints: ['Kan afstandelijk lijken', 'Onvoldoende geduld met inefficiëntie'],
      tips: ['Vertaal visie naar begrijpelijke stappen', 'Check regelmatig teamgevoel']
    },
    INTP: {
      shortDescription: 'Nieuwsgierige denker die patronen en systemen diep wil begrijpen.',
      longDescriptionNl: 'Je hebt een onderzoekende geest en wilt begrijpen hoe dingen fundamenteel werken. Je originaliteit groeit juist wanneer je ruimte krijgt om ideeën uit te pluizen.',
      werkstijlNl: 'Je functioneert goed met vrijheid, intellectuele diepte en minimale onderbrekingen. Je levert het meeste wanneer je concepten eerst kunt doorgronden.',
      valkuilenNl: 'Je kunt blijven verfijnen waardoor keuzes te laat vallen. De vertaalslag naar concrete actie blijft dan achter.',
      groeitipsNl: 'Werk met beslisdeadlines en een simpele definitie van “goed genoeg”. Deel voorlopige conclusies eerder zodat anderen kunnen aanhaken.',
      strengths: ['Logisch', 'Origineel', 'Objectief'],
      attentionPoints: ['Overanalyse', 'Minder aandacht voor praktische opvolging'],
      tips: ['Koppel ideeën aan concrete acties', 'Plan beslismomenten in']
    },
    INFJ: {
      shortDescription: 'Inzichtvolle idealist die betekenis en richting zoekt.',
      longDescriptionNl: 'Je combineert intuïtief inzicht met een sterke behoefte aan betekenis. Je ziet onderstromen in mensen en situaties en denkt graag in langetermijnontwikkeling.',
      werkstijlNl: 'Je werkt het best in een rustige context met heldere waarden en doelgericht werk. Diepe één-op-één samenwerking past je vaak beter dan voortdurende groepsdrukte.',
      valkuilenNl: 'Je legt de lat hoog voor jezelf en trekt veel verantwoordelijkheid naar je toe. Daardoor kan mentale overbelasting ongemerkt oplopen.',
      groeitipsNl: 'Maak verwachtingen expliciet en toets ze op haalbaarheid. Plan herstel net zo concreet als je taken en bewaak je energiegrenzen.',
      strengths: ['Intuïtief', 'Waarde-gedreven', 'Diep empathisch'],
      attentionPoints: ['Perfectionistisch', 'Snel mentaal overbelast'],
      tips: ['Bewaak energiegrenzen', 'Maak grote doelen meetbaar']
    },
    INFP: {
      shortDescription: 'Reflectieve idealist die authenticiteit en persoonlijke groei nastreeft.',
      longDescriptionNl: 'Je wordt gedreven door persoonlijke waarden en zoekt werk dat echt klopt met wie je bent. Met je verbeeldingskracht breng je nuance en originaliteit in gesprekken en ideeën.',
      werkstijlNl: 'Je komt tot je recht met autonomie, betekenisvolle doelen en ruimte voor reflectie. Een rustige omgeving helpt je om geconcentreerd en zorgvuldig te werken.',
      valkuilenNl: 'Je kunt beslissingen uitstellen als opties botsen met je idealen. Praktische prioriteiten raken dan op de achtergrond.',
      groeitipsNl: 'Vertaal grote idealen naar kleine dagelijkse acties. Oefen met duidelijke keuzes maken, ook als niet alles perfect voelt.',
      strengths: ['Creatief', 'Compassievol', 'Loyaal aan waarden'],
      attentionPoints: ['Stelt conflict uit', 'Kan moeite hebben met prioriteren'],
      tips: ['Kies dagelijks één hoofdtaak', 'Gebruik assertieve ik-boodschappen']
    }
  }
};

function buildStructuredFields(type, details) {
  const energy = type.startsWith('E')
    ? 'Je krijgt vaak energie van afstemming met anderen.'
    : 'Je presteert sterk met ruimte voor diepe, ongestoorde focus.';
  const processing = type.includes('N')
    ? 'Concepten, patronen en toekomstscenario\'s helpen je scherpte houden.'
    : 'Concreetheid, feiten en duidelijke stappen geven je rust.';
  const decisionStyle = type.includes('T')
    ? 'Je maakt keuzes graag op heldere criteria en logica.'
    : 'Je neemt waarden, impact op mensen en context bewust mee.';
  const structure = type.endsWith('J')
    ? 'Heldere planning en voorspelbaarheid maken je effectiever.'
    : 'Flexibiliteit en speelruimte houden je creatief en adaptief.';

  return {
    work_env: {
      base: `${details.werkstijlNl} ${energy} ${structure}`,
      personas: {
        individual_contributor: 'Als individuele bijdrager helpt het om je week te beschermen met focusblokken en expliciete opleverpunten.',
        manager: 'Als manager helpt het om teamritme en beslisregels expliciet te maken zodat iedereen weet waar hij aan toe is.',
        student: 'Als student werkt een vaste leerstructuur met korte evaluaties meestal beter dan spontaan studeren.'
      }
    },
    communication: {
      base: `${decisionStyle} ${processing}`,
      personas: {
        individual_contributor: 'Als individuele bijdrager: stem verwachtingen vroeg af en deel tussentijdse voortgang voordat je afrondt.',
        manager: 'Als manager: benoem naast het wat ook het waarom, zodat verschillende werkstijlen aangehaakt blijven.',
        student: 'Als student: vat na colleges of groepswerk de afspraken kort samen om misverstanden te voorkomen.'
      }
    },
    team_risks: {
      base: `${details.valkuilenNl} Let op wanneer tempo of druk oploopt; dan worden natuurlijke voorkeuren vaak scherper.`,
      personas: {
        individual_contributor: 'Als individuele bijdrager is het risico dat je te lang zelfstandig oplost en te laat afstemt.',
        manager: 'Als manager is het risico dat teamleden jouw voorkeursstijl gaan kopiëren en alternatieve perspectieven wegvallen.',
        student: 'Als student is het risico dat je onder tijdsdruk terugvalt op bekende patronen en minder experimenteert.'
      }
    },
    collab_tips: {
      base: `${details.groeitipsNl}`,
      personas: {
        individual_contributor: 'Als individuele bijdrager: plan één vast terugkoppelingsmoment per werkperiode of week en vertaal terugkoppeling naar één concrete actie.',
        manager: 'Als manager: combineer resultaatmeting met teamgezondheid, zodat samenwerking net zo zichtbaar wordt als resultaat.',
        student: 'Als student: werk met een verantwoordingspartner om doelen klein te maken en voortgang vol te houden.'
      }
    }
  };
}

Object.entries(RESULT_CONTENT.types).forEach(([type, details]) => {
  const structuredFields = buildStructuredFields(type, details);

  details.work_env = structuredFields.work_env;
  details.communication = structuredFields.communication;
  details.team_risks = structuredFields.team_risks;
  details.collab_tips = structuredFields.collab_tips;
});
