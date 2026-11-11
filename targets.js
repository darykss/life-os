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
