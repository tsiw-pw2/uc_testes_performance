/**
 * Constantes da base de dados de demonstração (api/scripts/seed).
 * Centraliza IDs, e-mails e títulos para os testes Selenium.
 */
module.exports = {
  EMAIL: "admin@demo.pt",
  PASSWORD: "Demo2026!",

  USERS: {
    admin: {
      id: "10000000-0000-4000-8000-000000000001",
      name: "Ana Administradora",
      email: "admin@demo.pt",
    },
    organizer: {
      id: "10000000-0000-4000-8000-000000000002",
      name: "Bruno Organizador",
      email: "organizador@demo.pt",
    },
    volunteer1: {
      id: "10000000-0000-4000-8000-000000000003",
      name: "Carla Voluntária",
      email: "voluntario1@demo.pt",
    },
    volunteer2: {
      id: "10000000-0000-4000-8000-000000000004",
      name: "Diogo Voluntário",
      email: "voluntario2@demo.pt",
    },
  },

  CAMPAIGNS: {
    planned: {
      id: "60000000-0000-4000-8000-000000000001",
      title: "Limpeza Outono - Planeada",
    },
    open: {
      id: "60000000-0000-4000-8000-000000000002",
      title: "Limpeza Espinho - Inscrições abertas",
    },
    inProgress: {
      id: "60000000-0000-4000-8000-000000000003",
      title: "Limpeza Norte - Em progresso",
    },
    completed: {
      id: "60000000-0000-4000-8000-000000000004",
      title: "Limpeza Primavera - Concluída",
    },
    closed: {
      id: "60000000-0000-4000-8000-000000000005",
      title: "Limpeza Matosinhos - Inscrições encerradas",
    },
    cancelled: {
      id: "60000000-0000-4000-8000-000000000006",
      title: "Limpeza Douro - Cancelada",
    },
    empty: {
      id: "60000000-0000-4000-8000-000000000007",
      title: "Campanha Vazia - Sem dados",
    },
  },

  BEACHES: {
    espinho: "Praia de Espinho",
    azurara: "Praia da Azurara",
    codicheira: "Praia da Codicheira",
  },

  WASTE: {
    garrafaPet: "Garrafa PET",
  },
};
