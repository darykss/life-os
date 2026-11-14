// Cibles LinkedIn : 48 profils, 12 par domaine. Une nouvelle cible chaque semaine.
// role : intitulé affiché · kw : mots-clés de la recherche LinkedIn · ask : la question à poser.
const LI_CATS = {
  entre: { label: 'Entrepreneuriat', topic: "l'entrepreneuriat" },
  commerce: { label: 'Commerce', topic: 'la vente et le développement commercial' },
  manage: { label: 'Management', topic: 'le management' },
  business: { label: 'Business', topic: 'la stratégie et le business' },
};

const LI_TARGETS = [
  // Entrepreneuriat
  { cat: 'entre', role: 'Fondateur de startup', kw: 'fondateur startup', ask: "Je serais curieux de savoir comment vous avez trouvé votre idée et vos tout premiers clients." },
  { cat: 'entre', role: 'Fondateur de marque e-commerce', kw: 'fondateur marque e-commerce DNVB', ask: "J'aimerais comprendre comment vous avez lancé la marque et trouvé vos premiers canaux d'acquisition." },
  { cat: 'entre', role: 'CEO de PME', kw: 'CEO dirigeant PME', ask: "J'aimerais comprendre à quoi ressemble concrètement le quotidien d'un dirigeant de PME." },
  { cat: 'entre', role: "Repreneur d'entreprise", kw: 'repreneur entreprise', ask: "Je me demande ce qui vous a fait choisir la reprise plutôt que la création." },
  { cat: 'entre', role: 'Fondateur passé par un incubateur', kw: 'fondateur Station F incubateur', ask: "Je voudrais savoir ce que l'incubateur vous a réellement apporté dans les premiers mois." },
  { cat: 'entre', role: "Fondateur d'agence marketing", kw: 'fondateur agence marketing digital', ask: "J'aimerais savoir comment vous avez signé vos premiers clients sans références." },
  { cat: 'entre', role: 'Créateur de contenu devenu entrepreneur', kw: 'créateur de contenu entrepreneur fondateur', ask: "Je développe moi-même un projet sur TikTok et j'aimerais comprendre comment vous avez transformé une audience en business." },
  { cat: 'entre', role: 'Franchisé multi-sites', kw: 'franchisé multi-sites dirigeant', ask: "Je me demande ce que la franchise change par rapport à une création en partant de zéro." },
  { cat: 'entre', role: 'Fondateur de SaaS B2B', kw: 'fondateur SaaS B2B', ask: "J'aimerais savoir comment vous avez validé le besoin avant de construire le produit." },
  { cat: 'entre', role: 'Serial entrepreneur', kw: 'serial entrepreneur', ask: "Je serais curieux de savoir ce que vous faites différemment aujourd'hui par rapport à votre première entreprise." },
  { cat: 'entre', role: 'Entrepreneur étudiant', kw: 'étudiant entrepreneur fondateur', ask: "J'aimerais savoir comment vous avez concilié études et lancement de votre projet." },
  { cat: 'entre', role: 'Business angel', kw: 'business angel investisseur', ask: "Je voudrais comprendre ce que vous regardez en premier chez un fondateur." },

  // Commerce
  { cat: 'commerce', role: 'Business Developer', kw: 'business developer', ask: "J'aimerais comprendre à quoi ressemble une semaine type et ce qui fait la différence dans la prospection." },
  { cat: 'commerce', role: 'Account Executive en SaaS', kw: 'account executive SaaS', ask: "Je serais curieux de savoir comment se déroule un cycle de vente de A à Z." },
  { cat: 'commerce', role: 'Directeur commercial', kw: 'directeur commercial', ask: "J'aimerais savoir quel parcours vous a mené à ce poste et ce que vous attendez d'un jeune commercial." },
  { cat: 'commerce', role: 'Key Account Manager', kw: 'key account manager grands comptes', ask: "Je voudrais comprendre comment on construit une relation de long terme avec un grand compte." },
  { cat: 'commerce', role: 'Sales Development Representative', kw: 'sales development representative SDR', ask: "Je me demande ce que ce premier poste vous a appris sur la vente." },
  { cat: 'commerce', role: 'Head of Sales', kw: 'head of sales', ask: "J'aimerais savoir comment vous avez structuré votre équipe commerciale." },
  { cat: 'commerce', role: 'Responsable export', kw: 'responsable export international', ask: "Je serais curieux de comprendre comment on ouvre un nouveau marché à l'international." },
  { cat: 'commerce', role: 'Ingénieur commercial', kw: 'ingénieur commercial', ask: "J'aimerais savoir comment on vend une offre technique à des non-techniciens." },
  { cat: 'commerce', role: 'Category Manager en grande distribution', kw: 'category manager grande distribution', ask: "Je voudrais comprendre comment se négocient les référencements avec les marques." },
  { cat: 'commerce', role: 'Acheteur', kw: 'acheteur achats', ask: "Je serais curieux d'avoir votre regard, côté achats, sur ce qui fait un bon commercial." },
  { cat: 'commerce', role: 'Customer Success Manager', kw: 'customer success manager', ask: "J'aimerais comprendre comment on fidélise et développe un client après la signature." },
  { cat: 'commerce', role: 'Responsable partenariats', kw: 'responsable partenariats partnerships manager', ask: "Je me demande comment on identifie et on convainc un bon partenaire." },

  // Management
  { cat: 'manage', role: 'Directeur de magasin', kw: 'directeur de magasin', ask: "J'aimerais savoir comment vous animez une équipe au quotidien et pilotez vos résultats." },
  { cat: 'manage', role: 'Chef de projet', kw: 'chef de projet', ask: "Je voudrais comprendre comment on fait avancer une équipe sans lien hiérarchique." },
  { cat: 'manage', role: 'Directeur des opérations (COO)', kw: 'directeur des opérations COO', ask: "Je serais curieux de savoir ce que recouvre vraiment votre rôle et comment vous priorisez." },
  { cat: 'manage', role: 'Team Leader commercial', kw: 'team leader sales manager', ask: "J'aimerais savoir comment s'est passée votre transition de commercial à manager." },
  { cat: 'manage', role: 'Responsable des ressources humaines', kw: 'responsable ressources humaines RRH', ask: "Je me demande ce qui distingue, selon vous, un bon manager d'un excellent manager." },
  { cat: 'manage', role: "Directeur d'agence", kw: "directeur d'agence", ask: "J'aimerais comprendre comment on pilote un centre de profit et son équipe." },
  { cat: 'manage', role: 'Product Manager', kw: 'product manager', ask: "Je voudrais comprendre comment vous arbitrez entre les demandes des clients, de la tech et du business." },
  { cat: 'manage', role: 'Chief of Staff', kw: 'chief of staff', ask: "Je serais curieux de savoir à quoi ressemble ce poste encore peu connu, au plus près d'un dirigeant." },
  { cat: 'manage', role: 'Manager en cabinet de conseil', kw: 'manager conseil consulting', ask: "J'aimerais savoir comment on passe de consultant à manager d'équipe." },
  { cat: 'manage', role: "Directeur d'usine", kw: "directeur d'usine site industriel", ask: "Je voudrais comprendre comment on manage plusieurs centaines de personnes sur un site." },
  { cat: 'manage', role: "Directeur de business unit", kw: 'directeur business unit', ask: "J'aimerais savoir comment on porte la responsabilité d'un compte de résultat." },
  { cat: 'manage', role: 'Jeune manager issu d\'un graduate program', kw: 'graduate program manager', ask: "Je me demande ce que ce programme vous a apporté et si vous le recommanderiez." },

  // Business
  { cat: 'business', role: 'Consultant en stratégie', kw: 'consultant stratégie', ask: "J'aimerais comprendre à quoi ressemble une mission type et comment vous avez préparé les entretiens." },
  { cat: 'business', role: 'Analyste en Venture Capital', kw: 'analyste venture capital VC', ask: "Je serais curieux de savoir comment vous évaluez une startup en quelques minutes." },
  { cat: 'business', role: 'Analyste en Private Equity', kw: 'analyste private equity', ask: "J'aimerais comprendre votre métier et le parcours qui y mène." },
  { cat: 'business', role: 'Analyste M&A', kw: 'analyste M&A fusions acquisitions', ask: "Je voudrais comprendre le déroulé d'une opération et le rythme du métier." },
  { cat: 'business', role: 'Growth Manager', kw: 'growth manager', ask: "Je me demande quels leviers de croissance fonctionnent le mieux aujourd'hui." },
  { cat: 'business', role: 'Chef de produit marketing', kw: 'chef de produit marketing', ask: "J'aimerais savoir comment se construit le lancement d'un nouveau produit." },
  { cat: 'business', role: 'Responsable e-commerce', kw: 'responsable e-commerce', ask: "Je voudrais comprendre quels indicateurs vous suivez chaque jour." },
  { cat: 'business', role: 'Directeur marketing (CMO)', kw: 'directeur marketing CMO', ask: "J'aimerais savoir comment vous répartissez votre budget entre les canaux." },
  { cat: 'business', role: 'Contrôleur de gestion', kw: 'contrôleur de gestion', ask: "Je serais curieux de comprendre comment la finance aide concrètement les opérationnels à décider." },
  { cat: 'business', role: 'Responsable Social Media / Influence', kw: 'responsable social media influence', ask: "Je développe un projet sur TikTok et j'aimerais avoir votre regard sur ce qui marche côté marques." },
  { cat: 'business', role: 'Diplômé récent d\'école de commerce', kw: 'jeune diplômé HEC ESSEC ESCP EDHEC emlyon', ask: "Je prépare les concours et j'aimerais savoir ce que l'école vous a réellement apporté et comment vous avez choisi votre voie." },
  { cat: 'business', role: 'Directeur général de filiale', kw: 'directeur général filiale country manager', ask: "J'aimerais comprendre comment on pilote un pays ou une filiale au sein d'un groupe." },
];

// ---- Secteurs supplémentaires (version 3) ----
Object.assign(LI_CATS, {
  finance: { label: 'Finance', topic: 'la finance' },
  compta: { label: 'Expertise comptable, audit, contrôle de gestion', topic: "l'expertise comptable, l'audit et le contrôle de gestion" },
  supply: { label: 'Supply chain', topic: 'la supply chain et la logistique' },
  eco: { label: 'Économie', topic: "l'économie" },
});
LI_CATS.commerce.label = 'Commerce / Sales';

LI_TARGETS.push(
  // Finance
  { cat: 'finance', role: 'Analyste financier', kw: 'analyste financier', ask: "J'aimerais comprendre à quoi ressemble votre quotidien et quelles compétences comptent le plus." },
  { cat: 'finance', role: 'Analyste en banque d\'affaires', kw: 'analyste banque d\'affaires investment banking', ask: "Je serais curieux de connaître le rythme réel du métier et la façon dont vous avez préparé les entretiens." },
  { cat: 'finance', role: 'Gérant de portefeuille', kw: 'gérant de portefeuille asset management', ask: "J'aimerais savoir comment se construit une conviction d'investissement." },
  { cat: 'finance', role: 'Trader', kw: 'trader salle de marchés', ask: "Je voudrais comprendre à quoi ressemble une journée en salle de marchés." },
  { cat: 'finance', role: 'Directeur financier (CFO)', kw: 'directeur financier CFO', ask: "J'aimerais savoir quel parcours mène à ce poste et ce que vous arbitrez au quotidien." },
  { cat: 'finance', role: 'Responsable trésorerie', kw: 'responsable trésorerie trésorier', ask: "Je me demande comment on pilote la trésorerie d'une entreprise au jour le jour." },
  { cat: 'finance', role: 'Chargé d\'affaires entreprises', kw: 'chargé d\'affaires entreprises banque', ask: "J'aimerais comprendre comment vous décidez de financer ou non une entreprise." },
  { cat: 'finance', role: 'Conseiller en gestion de patrimoine', kw: 'conseiller gestion de patrimoine CGP', ask: "Je serais curieux de savoir comment vous construisez la confiance avec un nouveau client." },
  { cat: 'finance', role: 'Analyste crédit', kw: 'analyste crédit', ask: "Je voudrais comprendre comment on évalue la solidité d'une entreprise." },
  { cat: 'finance', role: 'Analyste risques', kw: 'analyste risques risk manager', ask: "J'aimerais savoir quels risques vous suivez et comment ils sont mesurés." },
  { cat: 'finance', role: 'Analyste en Private Equity', kw: 'analyste private equity', ask: "J'aimerais comprendre votre métier et le parcours qui y mène." },
  { cat: 'finance', role: 'Analyste M&A', kw: 'analyste M&A fusions acquisitions', ask: "Je voudrais comprendre le déroulé d'une opération et le rythme du métier." },

  // Expertise comptable, audit, contrôle de gestion
  { cat: 'compta', role: 'Expert-comptable', kw: 'expert-comptable', ask: "J'aimerais savoir comment vous accompagnez vos clients au-delà de la tenue des comptes." },
  { cat: 'compta', role: 'Expert-comptable stagiaire', kw: 'expert-comptable stagiaire DEC', ask: "Je serais curieux de savoir comment se passe le stage et la préparation du diplôme." },
  { cat: 'compta', role: 'Auditeur financier', kw: 'auditeur financier', ask: "J'aimerais comprendre à quoi ressemble une mission d'audit de A à Z." },
  { cat: 'compta', role: 'Auditeur en Big Four', kw: 'auditeur Deloitte EY KPMG PwC', ask: "Je me demande ce que les premières années en Big Four vous ont appris." },
  { cat: 'compta', role: 'Commissaire aux comptes', kw: 'commissaire aux comptes', ask: "Je voudrais comprendre votre rôle et la responsabilité qu'il implique." },
  { cat: 'compta', role: 'Contrôleur de gestion', kw: 'contrôleur de gestion', ask: "Je serais curieux de comprendre comment la finance aide concrètement les opérationnels à décider." },
  { cat: 'compta', role: 'Contrôleur de gestion industriel', kw: 'contrôleur de gestion industriel', ask: "J'aimerais savoir comment on suit les coûts d'une usine ou d'une ligne de production." },
  { cat: 'compta', role: 'Responsable comptable', kw: 'responsable comptable chef comptable', ask: "J'aimerais comprendre comment s'organise une clôture et le travail de votre équipe." },
  { cat: 'compta', role: 'Auditeur interne', kw: 'auditeur interne', ask: "Je voudrais savoir en quoi l'audit interne diffère de l'audit externe." },
  { cat: 'compta', role: 'Consolideur', kw: 'consolideur consolidation', ask: "Je me demande à quoi ressemble le métier de la consolidation dans un groupe." },
  { cat: 'compta', role: 'Consultant en transaction services', kw: 'transaction services consultant', ask: "J'aimerais comprendre comment se déroule une due diligence financière." },
  { cat: 'compta', role: 'Directeur administratif et financier (DAF)', kw: 'directeur administratif et financier DAF', ask: "J'aimerais savoir quel parcours mène au poste de DAF dans une PME." },

  // Supply chain
  { cat: 'supply', role: 'Supply Chain Manager', kw: 'supply chain manager', ask: "J'aimerais comprendre comment vous pilotez les flux de bout en bout." },
  { cat: 'supply', role: 'Responsable logistique', kw: 'responsable logistique', ask: "Je serais curieux de savoir à quoi ressemble une journée sur un site logistique." },
  { cat: 'supply', role: 'Acheteur', kw: 'acheteur achats', ask: "Je voudrais comprendre comment se prépare et se mène une négociation fournisseur." },
  { cat: 'supply', role: 'Demand Planner', kw: 'demand planner prévisionniste', ask: "J'aimerais savoir comment vous construisez une prévision de ventes fiable." },
  { cat: 'supply', role: 'Approvisionneur', kw: 'approvisionneur', ask: "Je me demande comment on évite à la fois les ruptures et les surstocks." },
  { cat: 'supply', role: 'Responsable d\'entrepôt', kw: 'responsable entrepôt', ask: "J'aimerais comprendre comment on organise et on anime une équipe en entrepôt." },
  { cat: 'supply', role: 'Responsable transport', kw: 'responsable transport', ask: "Je voudrais comprendre comment vous choisissez et suivez vos transporteurs." },
  { cat: 'supply', role: 'Directeur supply chain', kw: 'directeur supply chain', ask: "J'aimerais savoir quel parcours vous a mené à ce poste et quelles sont vos priorités." },
  { cat: 'supply', role: 'Consultant supply chain', kw: 'consultant supply chain', ask: "Je serais curieux de connaître les problèmes que vos clients vous demandent le plus souvent de résoudre." },
  { cat: 'supply', role: 'Responsable planification de production', kw: 'responsable planification production', ask: "J'aimerais comprendre comment se construit un plan de production." },
  { cat: 'supply', role: 'Responsable import-export', kw: 'responsable import-export', ask: "Je me demande ce qu'il faut maîtriser pour gérer des flux internationaux." },
  { cat: 'supply', role: 'Chef de projet logistique', kw: 'chef de projet logistique', ask: "J'aimerais savoir sur quels types de projets vous travaillez et comment vous les menez." },

  // Économie
  { cat: 'eco', role: 'Économiste', kw: 'économiste', ask: "J'aimerais comprendre à quoi ressemble votre travail au quotidien et à qui servent vos analyses." },
  { cat: 'eco', role: 'Chargé d\'études économiques', kw: 'chargé d\'études économiques', ask: "Je serais curieux de savoir comment se construit une étude, des données aux conclusions." },
  { cat: 'eco', role: 'Économiste de banque', kw: 'économiste banque recherche économique', ask: "J'aimerais savoir comment vos prévisions sont utilisées par les équipes de la banque." },
  { cat: 'eco', role: 'Économiste à la Banque de France', kw: 'économiste Banque de France', ask: "Je voudrais comprendre le rôle d'un économiste dans une banque centrale." },
  { cat: 'eco', role: 'Analyste macroéconomique', kw: 'analyste macroéconomie', ask: "Je me demande quels indicateurs vous suivez en priorité et pourquoi." },
  { cat: 'eco', role: 'Statisticien-économiste (INSEE)', kw: 'statisticien économiste INSEE', ask: "J'aimerais comprendre comment sont produits les chiffres que tout le monde commente." },
  { cat: 'eco', role: 'Data analyst', kw: 'data analyst', ask: "J'aimerais savoir comment une analyse de données devient une décision dans votre entreprise." },
  { cat: 'eco', role: 'Consultant en économie', kw: 'consultant économie cabinet conseil économique', ask: "Je serais curieux de connaître les questions que vos clients vous posent." },
  { cat: 'eco', role: 'Chargé de mission développement économique', kw: 'chargé de mission développement économique', ask: "J'aimerais comprendre comment une collectivité attire et accompagne les entreprises." },
  { cat: 'eco', role: 'Analyste en politiques publiques', kw: 'analyste politiques publiques', ask: "Je voudrais savoir comment on évalue l'effet réel d'une politique publique." },
  { cat: 'eco', role: 'Journaliste économique', kw: 'journaliste économique', ask: "Je me demande comment vous choisissez vos sujets et vérifiez vos informations." },
  { cat: 'eco', role: 'Économiste en organisation internationale', kw: 'économiste OCDE FMI Banque mondiale', ask: "J'aimerais connaître le parcours qui mène à une organisation internationale." },
);
