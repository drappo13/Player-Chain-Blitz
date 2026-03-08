export interface SlamPlayer {
  name: string;
}

export interface Tournament {
  tournament: string;
  year: number;
  surface: "grass" | "clay" | "hard";
  players: string[];
}

export const tournaments: Tournament[] = [
  {
    tournament: "Australian Open",
    year: 2000,
    surface: "hard",
    players: [
      "Andre Agassi", "Yevgeny Kafelnikov", "Pete Sampras", "Magnus Norman",
      "Nicolas Escude", "Chris Woodruff", "Nicolas Kiefer", "Hicham Arazi",
      "Thomas Enqvist", "Alberto Martin", "Arnaud Clement", "Michael Chang",
      "Mark Philippoussis", "Tommy Haas", "Wayne Ferreira", "Dominik Hrbaty"
    ]
  },
  {
    tournament: "Roland Garros",
    year: 2000,
    surface: "clay",
    players: [
      "Gustavo Kuerten", "Magnus Norman", "Juan Carlos Ferrero", "Franco Squillari",
      "Marat Safin", "Yevgeny Kafelnikov", "Lleyton Hewitt", "Alex Corretja",
      "Albert Costa", "Fabrice Santoro", "Cedric Pioline", "Dominik Hrbaty",
      "Fernando Vicente", "Arnaud Clement", "Richard Krajicek", "Nicolas Lapentti"
    ]
  },
  {
    tournament: "Wimbledon",
    year: 2000,
    surface: "grass",
    players: [
      "Pete Sampras", "Patrick Rafter", "Andre Agassi", "Vladimir Voltchkov",
      "Mark Philippoussis", "Byron Black", "Jan-Michael Gambill", "Jonas Bjorkman",
      "Lleyton Hewitt", "Alexander Popp", "Dominik Hrbaty", "Todd Martin",
      "Gustavo Kuerten", "Wayne Ferreira", "Nicolas Kiefer", "Thomas Enqvist"
    ]
  },
  {
    tournament: "US Open",
    year: 2000,
    surface: "hard",
    players: [
      "Marat Safin", "Pete Sampras", "Lleyton Hewitt", "Todd Martin",
      "Richard Krajicek", "Thomas Johansson", "Arnaud Clement", "Nicolas Kiefer",
      "Juan Carlos Ferrero", "Yevgeny Kafelnikov", "Wayne Ferreira", "Magnus Norman",
      "Andre Agassi", "Hicham Arazi", "Patrick Rafter", "Albert Costa"
    ]
  },
  {
    tournament: "Australian Open",
    year: 2001,
    surface: "hard",
    players: [
      "Andre Agassi", "Arnaud Clement", "Patrick Rafter", "Yevgeny Kafelnikov",
      "Pete Sampras", "Todd Martin", "Sebastien Grosjean", "Carlos Moya",
      "Dominik Hrbaty", "Jonas Bjorkman", "Thomas Enqvist", "Stefan Koubek",
      "Nicolas Escude", "Juan Ignacio Chela", "Andrew Ilie", "Jiri Novak"
    ]
  },
  {
    tournament: "Roland Garros",
    year: 2001,
    surface: "clay",
    players: [
      "Gustavo Kuerten", "Alex Corretja", "Juan Carlos Ferrero", "Sebastien Grosjean",
      "Lleyton Hewitt", "Marat Safin", "Roger Federer", "Andre Agassi",
      "Arnaud Clement", "Albert Costa", "Fabrice Santoro", "Andrei Pavel",
      "Fernando Vicente", "Franco Squillari", "Nicolas Lapentti", "Patrick Rafter"
    ]
  },
  {
    tournament: "Wimbledon",
    year: 2001,
    surface: "grass",
    players: [
      "Goran Ivanisevic", "Patrick Rafter", "Tim Henman", "Lleyton Hewitt",
      "Andre Agassi", "Pete Sampras", "Roger Federer", "Jonas Bjorkman",
      "Marat Safin", "Nicolas Escude", "Todd Martin", "Greg Rusedski",
      "Sebastien Grosjean", "Thomas Johansson", "Gustavo Kuerten", "Vladimir Voltchkov"
    ]
  },
  {
    tournament: "US Open",
    year: 2001,
    surface: "hard",
    players: [
      "Lleyton Hewitt", "Pete Sampras", "Andre Agassi", "Marat Safin",
      "Yevgeny Kafelnikov", "Tommy Haas", "Andy Roddick", "Roger Federer",
      "Patrick Rafter", "Tim Henman", "Nicolas Kiefer", "Carlos Moya",
      "Arnaud Clement", "Sebastien Grosjean", "Richard Krajicek", "Gustavo Kuerten"
    ]
  },
  {
    tournament: "Australian Open",
    year: 2002,
    surface: "hard",
    players: [
      "Thomas Johansson", "Marat Safin", "Tommy Haas", "Jonas Bjorkman",
      "Jiri Novak", "Roger Federer", "Lleyton Hewitt", "Albert Costa",
      "Andre Agassi", "Sebastien Grosjean", "Arnaud Clement", "Pete Sampras",
      "Yevgeny Kafelnikov", "Juan Ignacio Chela", "Wayne Ferreira", "Carlos Moya"
    ]
  },
  {
    tournament: "Roland Garros",
    year: 2002,
    surface: "clay",
    players: [
      "Albert Costa", "Juan Carlos Ferrero", "Alex Corretja", "Andre Agassi",
      "Marat Safin", "Lleyton Hewitt", "Gustavo Kuerten", "Roger Federer",
      "Guillermo Canas", "Wayne Ferreira", "Paul-Henri Mathieu", "Andrei Pavel",
      "Fernando Gonzalez", "Tommy Robredo", "Arnaud Clement", "Carlos Moya"
    ]
  },
  {
    tournament: "Wimbledon",
    year: 2002,
    surface: "grass",
    players: [
      "Lleyton Hewitt", "David Nalbandian", "Tim Henman", "Xavier Malisse",
      "Sjeng Schalken", "Marat Safin", "Andre Agassi", "Pete Sampras",
      "Jonas Bjorkman", "Wayne Ferreira", "Greg Rusedski", "Sebastien Grosjean",
      "Nicolas Escude", "Jiri Novak", "Thomas Johansson", "Andy Roddick"
    ]
  },
  {
    tournament: "US Open",
    year: 2002,
    surface: "hard",
    players: [
      "Pete Sampras", "Andre Agassi", "Lleyton Hewitt", "Sjeng Schalken",
      "Andy Roddick", "Roger Federer", "Tommy Haas", "Fernando Gonzalez",
      "Younes El Aynaoui", "Max Mirnyi", "Albert Costa", "Greg Rusedski",
      "Wayne Ferreira", "Jiri Novak", "James Blake", "Juan Carlos Ferrero"
    ]
  },
  {
    tournament: "Australian Open",
    year: 2003,
    surface: "hard",
    players: [
      "Andre Agassi", "Rainer Schuettler", "Andy Roddick", "Wayne Ferreira",
      "Roger Federer", "David Nalbandian", "Sebastien Grosjean", "Juan Carlos Ferrero",
      "Albert Costa", "Sjeng Schalken", "Younes El Aynaoui", "Lleyton Hewitt",
      "Carlos Moya", "Jiri Novak", "Nicolas Massu", "Tommy Haas"
    ]
  },
  {
    tournament: "Roland Garros",
    year: 2003,
    surface: "clay",
    players: [
      "Juan Carlos Ferrero", "Martin Verkerk", "Albert Costa", "Guillermo Coria",
      "Roger Federer", "Andre Agassi", "Fernando Gonzalez", "Carlos Moya",
      "Lleyton Hewitt", "Tommy Robredo", "Alex Corretja", "Gustavo Kuerten",
      "Felix Mantilla", "Mark Philippoussis", "David Nalbandian", "Arnaud Clement"
    ]
  },
  {
    tournament: "Wimbledon",
    year: 2003,
    surface: "grass",
    players: [
      "Roger Federer", "Mark Philippoussis", "Andy Roddick", "Jonas Bjorkman",
      "Sebastien Grosjean", "Tim Henman", "Mario Ancic", "Ivo Karlovic",
      "Andre Agassi", "Lleyton Hewitt", "David Nalbandian", "Alexander Popp",
      "Sjeng Schalken", "Wayne Ferreira", "Greg Rusedski", "Max Mirnyi"
    ]
  },
  {
    tournament: "US Open",
    year: 2003,
    surface: "hard",
    players: [
      "Andy Roddick", "Juan Carlos Ferrero", "David Nalbandian", "Andre Agassi",
      "Roger Federer", "Younes El Aynaoui", "Sjeng Schalken", "Lleyton Hewitt",
      "Tommy Haas", "Max Mirnyi", "Fernando Gonzalez", "Jiri Novak",
      "Carlos Moya", "Gustavo Kuerten", "Mark Philippoussis", "Sebastien Grosjean"
    ]
  },
  {
    tournament: "Australian Open",
    year: 2004,
    surface: "hard",
    players: [
      "Roger Federer", "Marat Safin", "Juan Carlos Ferrero", "Andre Agassi",
      "Andy Roddick", "Lleyton Hewitt", "David Nalbandian", "Sebastien Grosjean",
      "Albert Costa", "Sjeng Schalken", "Todd Martin", "Gustavo Kuerten",
      "Rainer Schuettler", "Tommy Haas", "Carlos Moya", "Hicham Arazi"
    ]
  },
  {
    tournament: "Roland Garros",
    year: 2004,
    surface: "clay",
    players: [
      "Gaston Gaudio", "Guillermo Coria", "David Nalbandian", "Tim Henman",
      "Roger Federer", "Gustavo Kuerten", "Carlos Moya", "Fernando Gonzalez",
      "Albert Costa", "Tommy Robredo", "Lleyton Hewitt", "Juan Ignacio Chela",
      "Igor Andreev", "Guillermo Canas", "Nicolas Massu", "Dominik Hrbaty"
    ]
  },
  {
    tournament: "Wimbledon",
    year: 2004,
    surface: "grass",
    players: [
      "Roger Federer", "Andy Roddick", "Lleyton Hewitt", "Sebastien Grosjean",
      "Mario Ancic", "Tim Henman", "Mark Philippoussis", "Florian Mayer",
      "Carlos Moya", "Todd Martin", "Ivo Karlovic", "Jonas Bjorkman",
      "Feliciano Lopez", "Juan Carlos Ferrero", "Thomas Johansson", "Sjeng Schalken"
    ]
  },
  {
    tournament: "US Open",
    year: 2004,
    surface: "hard",
    players: [
      "Roger Federer", "Lleyton Hewitt", "Andre Agassi", "Joachim Johansson",
      "Andy Roddick", "Tommy Haas", "Dominik Hrbaty", "Sargis Sargsian",
      "Tim Henman", "Olivier Rochus", "Tommy Robredo", "Nicolas Kiefer",
      "Fernando Gonzalez", "David Nalbandian", "Carlos Moya", "Albert Costa"
    ]
  },
  {
    tournament: "Australian Open",
    year: 2005,
    surface: "hard",
    players: [
      "Marat Safin", "Lleyton Hewitt", "Roger Federer", "Andy Roddick",
      "Andre Agassi", "Nikolay Davydenko", "David Nalbandian", "Fernando Gonzalez",
      "Sebastien Grosjean", "Tommy Haas", "Dominik Hrbaty", "Nicolas Kiefer",
      "Juan Carlos Ferrero", "Guillermo Coria", "Carlos Moya", "Marcos Baghdatis"
    ]
  },
  {
    tournament: "Roland Garros",
    year: 2005,
    surface: "clay",
    players: [
      "Rafael Nadal", "Mariano Puerta", "Roger Federer", "David Nalbandian",
      "Guillermo Coria", "Nikolay Davydenko", "Fernando Gonzalez", "Carlos Moya",
      "Gaston Gaudio", "Sebastien Grosjean", "Lleyton Hewitt", "Albert Costa",
      "Gustavo Kuerten", "Tommy Robredo", "David Ferrer", "Mario Ancic"
    ]
  },
  {
    tournament: "Wimbledon",
    year: 2005,
    surface: "grass",
    players: [
      "Roger Federer", "Andy Roddick", "Lleyton Hewitt", "Thomas Johansson",
      "Sebastien Grosjean", "Fernando Gonzalez", "David Nalbandian", "Feliciano Lopez",
      "Rafael Nadal", "Juan Carlos Ferrero", "Ivo Karlovic", "Marat Safin",
      "Guillermo Coria", "Jarkko Nieminen", "Mario Ancic", "Nikolay Davydenko"
    ]
  },
  {
    tournament: "US Open",
    year: 2005,
    surface: "hard",
    players: [
      "Roger Federer", "Andre Agassi", "Lleyton Hewitt", "Robby Ginepri",
      "James Blake", "Rafael Nadal", "David Nalbandian", "Guillermo Coria",
      "Tommy Robredo", "Fernando Gonzalez", "Nicolas Kiefer", "Gaston Gaudio",
      "Nikolay Davydenko", "Andy Roddick", "Sebastien Grosjean", "Feliciano Lopez"
    ]
  },
  {
    tournament: "Australian Open",
    year: 2006,
    surface: "hard",
    players: [
      "Roger Federer", "Marcos Baghdatis", "David Nalbandian", "Nicolas Kiefer",
      "Nikolay Davydenko", "Tommy Haas", "Ivan Ljubicic", "Mario Ancic",
      "Lleyton Hewitt", "Fernando Gonzalez", "Tommy Robredo", "Andre Agassi",
      "Max Mirnyi", "James Blake", "Fabrice Santoro", "Carlos Moya"
    ]
  },
  {
    tournament: "Roland Garros",
    year: 2006,
    surface: "clay",
    players: [
      "Rafael Nadal", "Roger Federer", "Ivan Ljubicic", "David Nalbandian",
      "Nikolay Davydenko", "Lleyton Hewitt", "Fernando Gonzalez", "Tommy Robredo",
      "Gaston Gaudio", "Mario Ancic", "Nicolas Mahut", "Paul-Henri Mathieu",
      "David Ferrer", "Novak Djokovic", "Albert Montanes", "Guillermo Coria"
    ]
  },
  {
    tournament: "Wimbledon",
    year: 2006,
    surface: "grass",
    players: [
      "Roger Federer", "Rafael Nadal", "Jonas Bjorkman", "Marcos Baghdatis",
      "Lleyton Hewitt", "Jarkko Nieminen", "Mario Ancic", "Tim Henman",
      "Andy Roddick", "Radek Stepanek", "Dmitry Tursunov", "Richard Gasquet",
      "Nicolas Mahut", "Juan Carlos Ferrero", "Ivo Karlovic", "Tommy Haas"
    ]
  },
  {
    tournament: "US Open",
    year: 2006,
    surface: "hard",
    players: [
      "Roger Federer", "Andy Roddick", "Nikolay Davydenko", "Mikhail Youzhny",
      "James Blake", "Rafael Nadal", "Tommy Robredo", "Lleyton Hewitt",
      "Marcos Baghdatis", "David Nalbandian", "Andre Agassi", "Benjamin Becker",
      "Fernando Gonzalez", "Richard Gasquet", "Ivan Ljubicic", "Andy Murray"
    ]
  },
  {
    tournament: "Australian Open",
    year: 2007,
    surface: "hard",
    players: [
      "Roger Federer", "Fernando Gonzalez", "Andy Roddick", "Tommy Haas",
      "Novak Djokovic", "Rafael Nadal", "Andy Murray", "Nikolay Davydenko",
      "Mikhail Youzhny", "Ivan Ljubicic", "Marcos Baghdatis", "James Blake",
      "Tommy Robredo", "Lleyton Hewitt", "Mario Ancic", "Marat Safin"
    ]
  },
  {
    tournament: "Roland Garros",
    year: 2007,
    surface: "clay",
    players: [
      "Rafael Nadal", "Roger Federer", "Novak Djokovic", "Nikolay Davydenko",
      "Tommy Robredo", "Carlos Moya", "Lleyton Hewitt", "Igor Andreev",
      "David Nalbandian", "Ivan Ljubicic", "Guillermo Canas", "Filippo Volandri",
      "Fernando Gonzalez", "Andy Murray", "Robin Soderling", "Marcos Baghdatis"
    ]
  },
  {
    tournament: "Wimbledon",
    year: 2007,
    surface: "grass",
    players: [
      "Roger Federer", "Rafael Nadal", "Novak Djokovic", "Marcos Baghdatis",
      "Andy Roddick", "Richard Gasquet", "Fernando Gonzalez", "Juan Carlos Ferrero",
      "Robin Soderling", "Lleyton Hewitt", "Tomas Berdych", "Marat Safin",
      "Feliciano Lopez", "Ivo Karlovic", "Jonas Bjorkman", "Andy Murray"
    ]
  },
  {
    tournament: "US Open",
    year: 2007,
    surface: "hard",
    players: [
      "Roger Federer", "Novak Djokovic", "David Ferrer", "Nikolay Davydenko",
      "Juan Martin del Potro", "Carlos Moya", "Andy Roddick", "Tommy Robredo",
      "James Blake", "John Isner", "Marcos Baghdatis", "Lleyton Hewitt",
      "Fernando Gonzalez", "Tommy Haas", "Feliciano Lopez", "Mikhail Youzhny"
    ]
  },
  {
    tournament: "Australian Open",
    year: 2008,
    surface: "hard",
    players: [
      "Novak Djokovic", "Jo-Wilfried Tsonga", "Roger Federer", "Janko Tipsarevic",
      "Rafael Nadal", "Lleyton Hewitt", "David Ferrer", "James Blake",
      "Richard Gasquet", "Mikhail Youzhny", "Marcos Baghdatis", "Mardy Fish",
      "Juan Martin del Potro", "Tommy Haas", "Tomas Berdych", "Lucas Pouille"
    ]
  },
  {
    tournament: "Roland Garros",
    year: 2008,
    surface: "clay",
    players: [
      "Rafael Nadal", "Roger Federer", "Novak Djokovic", "David Ferrer",
      "Gael Monfils", "Nicolas Almagro", "Fernando Gonzalez", "Nikolay Davydenko",
      "Andy Murray", "Carlos Moya", "Paul-Henri Mathieu", "Ivan Ljubicic",
      "Robin Soderling", "Juan Martin del Potro", "Lleyton Hewitt", "Tommy Robredo"
    ]
  },
  {
    tournament: "Wimbledon",
    year: 2008,
    surface: "grass",
    players: [
      "Rafael Nadal", "Roger Federer", "Marat Safin", "Rainer Schuettler",
      "Andy Murray", "Richard Gasquet", "Lleyton Hewitt", "Mario Ancic",
      "Novak Djokovic", "Arnaud Clement", "Andy Roddick", "Mikhail Youzhny",
      "Feliciano Lopez", "Ivo Karlovic", "Robin Soderling", "Juan Martin del Potro"
    ]
  },
  {
    tournament: "US Open",
    year: 2008,
    surface: "hard",
    players: [
      "Roger Federer", "Andy Murray", "Rafael Nadal", "Novak Djokovic",
      "Juan Martin del Potro", "Andy Roddick", "Nikolay Davydenko", "Gilles Muller",
      "David Ferrer", "Gilles Simon", "Mardy Fish", "Radek Stepanek",
      "Sam Querrey", "Igor Andreev", "Tommy Robredo", "Lleyton Hewitt"
    ]
  },
  {
    tournament: "Australian Open",
    year: 2009,
    surface: "hard",
    players: [
      "Rafael Nadal", "Roger Federer", "Fernando Verdasco", "Jo-Wilfried Tsonga",
      "Novak Djokovic", "Gilles Simon", "Andy Roddick", "Nikolay Davydenko",
      "James Blake", "Gael Monfils", "Juan Martin del Potro", "Andy Murray",
      "Marin Cilic", "Tomas Berdych", "Marcos Baghdatis", "Kei Nishikori"
    ]
  },
  {
    tournament: "Roland Garros",
    year: 2009,
    surface: "clay",
    players: [
      "Roger Federer", "Robin Soderling", "Rafael Nadal", "Juan Martin del Potro",
      "Novak Djokovic", "Fernando Gonzalez", "Nikolay Davydenko", "Tommy Haas",
      "Andy Murray", "Fernando Verdasco", "David Ferrer", "Tommy Robredo",
      "Gael Monfils", "Paul-Henri Mathieu", "Jo-Wilfried Tsonga", "Philipp Kohlschreiber"
    ]
  },
  {
    tournament: "Wimbledon",
    year: 2009,
    surface: "grass",
    players: [
      "Roger Federer", "Andy Roddick", "Andy Murray", "Tommy Haas",
      "Rafael Nadal", "Lleyton Hewitt", "Ivo Karlovic", "Juan Martin del Potro",
      "Novak Djokovic", "Stanislas Wawrinka", "Fernando Verdasco", "Radek Stepanek",
      "Robin Soderling", "Jo-Wilfried Tsonga", "Feliciano Lopez", "Tomas Berdych"
    ]
  },
  {
    tournament: "US Open",
    year: 2009,
    surface: "hard",
    players: [
      "Juan Martin del Potro", "Roger Federer", "Rafael Nadal", "Novak Djokovic",
      "Fernando Gonzalez", "Robin Soderling", "Fernando Verdasco", "Andy Murray",
      "Marin Cilic", "Jo-Wilfried Tsonga", "Nikolay Davydenko", "Tommy Robredo",
      "Sam Querrey", "John Isner", "Lleyton Hewitt", "Jack Sock"
    ]
  },
  {
    tournament: "Australian Open",
    year: 2010,
    surface: "hard",
    players: [
      "Roger Federer", "Andy Murray", "Novak Djokovic", "Jo-Wilfried Tsonga",
      "Nikolay Davydenko", "Marin Cilic", "Fernando Verdasco", "Rafael Nadal",
      "John Isner", "Andy Roddick", "Lleyton Hewitt", "Robin Soderling",
      "Marcos Baghdatis", "Ivan Ljubicic", "Tommy Robredo", "Mikhail Youzhny"
    ]
  },
  {
    tournament: "Roland Garros",
    year: 2010,
    surface: "clay",
    players: [
      "Rafael Nadal", "Robin Soderling", "Jurgen Melzer", "Tomas Berdych",
      "Roger Federer", "Novak Djokovic", "Nicolas Almagro", "Mikhail Youzhny",
      "David Ferrer", "Andy Murray", "Jo-Wilfried Tsonga", "Andy Roddick",
      "Ernests Gulbis", "Ivan Ljubicic", "Fernando Gonzalez", "Gael Monfils"
    ]
  },
  {
    tournament: "Wimbledon",
    year: 2010,
    surface: "grass",
    players: [
      "Rafael Nadal", "Tomas Berdych", "Novak Djokovic", "Andy Murray",
      "Roger Federer", "Robin Soderling", "Jo-Wilfried Tsonga", "Yen-Hsun Lu",
      "Sam Querrey", "John Isner", "Lleyton Hewitt", "Marcos Baghdatis",
      "Philipp Kohlschreiber", "Jurgen Melzer", "Nicolas Mahut", "Feliciano Lopez"
    ]
  },
  {
    tournament: "US Open",
    year: 2010,
    surface: "hard",
    players: [
      "Rafael Nadal", "Novak Djokovic", "Roger Federer", "Robin Soderling",
      "Mikhail Youzhny", "Stanislas Wawrinka", "Fernando Verdasco", "Andy Murray",
      "Gael Monfils", "Tomas Berdych", "David Ferrer", "Sam Querrey",
      "Albert Montanes", "John Isner", "Mardy Fish", "Marin Cilic"
    ]
  },
  {
    tournament: "Australian Open",
    year: 2011,
    surface: "hard",
    players: [
      "Novak Djokovic", "Andy Murray", "Roger Federer", "David Ferrer",
      "Stanislas Wawrinka", "Tomas Berdych", "Robin Soderling", "Alexandr Dolgopolov",
      "Jurgen Melzer", "Marin Cilic", "Fernando Verdasco", "Gael Monfils",
      "Rafael Nadal", "Andy Roddick", "Nicolas Almagro", "Marcos Baghdatis"
    ]
  },
  {
    tournament: "Roland Garros",
    year: 2011,
    surface: "clay",
    players: [
      "Rafael Nadal", "Roger Federer", "Andy Murray", "Juan Martin del Potro",
      "Novak Djokovic", "Fabio Fognini", "Robin Soderling", "Gael Monfils",
      "David Ferrer", "Jo-Wilfried Tsonga", "Fernando Verdasco", "Stanislas Wawrinka",
      "Tomas Berdych", "Nicolas Almagro", "Viktor Troicki", "Richard Gasquet"
    ]
  },
  {
    tournament: "Wimbledon",
    year: 2011,
    surface: "grass",
    players: [
      "Novak Djokovic", "Rafael Nadal", "Andy Murray", "Jo-Wilfried Tsonga",
      "Roger Federer", "David Ferrer", "Tomas Berdych", "Mardy Fish",
      "Robin Soderling", "Feliciano Lopez", "Juan Martin del Potro", "Viktor Troicki",
      "Ivo Karlovic", "Bernard Tomic", "Marcos Baghdatis", "Philipp Kohlschreiber"
    ]
  },
  {
    tournament: "US Open",
    year: 2011,
    surface: "hard",
    players: [
      "Novak Djokovic", "Rafael Nadal", "Roger Federer", "Andy Murray",
      "Jo-Wilfried Tsonga", "John Isner", "David Ferrer", "Janko Tipsarevic",
      "Gilles Muller", "Marin Cilic", "Juan Martin del Potro", "Gilles Simon",
      "Mardy Fish", "Donald Young", "Alex Bogomolov Jr.", "Andy Roddick"
    ]
  },
  {
    tournament: "Australian Open",
    year: 2012,
    surface: "hard",
    players: [
      "Novak Djokovic", "Rafael Nadal", "Roger Federer", "Andy Murray",
      "David Ferrer", "Juan Martin del Potro", "Tomas Berdych", "Kei Nishikori",
      "Nicolas Almagro", "Alexandr Dolgopolov", "Feliciano Lopez", "Lleyton Hewitt",
      "Mikhail Kukushkin", "Jo-Wilfried Tsonga", "Richard Gasquet", "Milos Raonic"
    ]
  },
  {
    tournament: "Roland Garros",
    year: 2012,
    surface: "clay",
    players: [
      "Rafael Nadal", "Novak Djokovic", "Roger Federer", "David Ferrer",
      "Andy Murray", "Nicolas Almagro", "Jo-Wilfried Tsonga", "Juan Martin del Potro",
      "Tomas Berdych", "Marcel Granollers", "Andreas Seppi", "Kei Nishikori",
      "Mikhail Youzhny", "Fernando Verdasco", "Sam Querrey", "John Isner"
    ]
  },
  {
    tournament: "Wimbledon",
    year: 2012,
    surface: "grass",
    players: [
      "Roger Federer", "Andy Murray", "Novak Djokovic", "Jo-Wilfried Tsonga",
      "David Ferrer", "Philipp Kohlschreiber", "Florian Mayer", "Mikhail Youzhny",
      "Rafael Nadal", "Marin Cilic", "Mardy Fish", "Xavier Malisse",
      "Andy Roddick", "Tomas Berdych", "Juan Martin del Potro", "Feliciano Lopez"
    ]
  },
  {
    tournament: "US Open",
    year: 2012,
    surface: "hard",
    players: [
      "Andy Murray", "Novak Djokovic", "David Ferrer", "Tomas Berdych",
      "Roger Federer", "Marin Cilic", "Janko Tipsarevic", "Stanislas Wawrinka",
      "Andy Roddick", "Juan Martin del Potro", "Milos Raonic", "Rafael Nadal",
      "John Isner", "Philipp Kohlschreiber", "Marcos Baghdatis", "Sam Querrey"
    ]
  },
  {
    tournament: "Australian Open",
    year: 2013,
    surface: "hard",
    players: [
      "Novak Djokovic", "Andy Murray", "Roger Federer", "David Ferrer",
      "Jo-Wilfried Tsonga", "Tomas Berdych", "Nicolas Almagro", "Jeremy Chardy",
      "Stanislas Wawrinka", "Janko Tipsarevic", "Juan Martin del Potro", "Gilles Simon",
      "Kei Nishikori", "Marin Cilic", "Philipp Kohlschreiber", "Richard Gasquet"
    ]
  },
  {
    tournament: "Roland Garros",
    year: 2013,
    surface: "clay",
    players: [
      "Rafael Nadal", "David Ferrer", "Novak Djokovic", "Jo-Wilfried Tsonga",
      "Roger Federer", "Tommy Haas", "Stanislas Wawrinka", "Richard Gasquet",
      "Gael Monfils", "Tommy Robredo", "Kei Nishikori", "Mikhail Youzhny",
      "Fernando Verdasco", "Kevin Anderson", "Marin Cilic", "John Isner"
    ]
  },
  {
    tournament: "Wimbledon",
    year: 2013,
    surface: "grass",
    players: [
      "Andy Murray", "Novak Djokovic", "Juan Martin del Potro", "Jerzy Janowicz",
      "Roger Federer", "David Ferrer", "Fernando Verdasco", "Lukasz Kubot",
      "Jo-Wilfried Tsonga", "Tommy Haas", "Tomas Berdych", "Bernard Tomic",
      "Andreas Seppi", "Kenny De Schepper", "Adrian Mannarino", "Kei Nishikori"
    ]
  },
  {
    tournament: "US Open",
    year: 2013,
    surface: "hard",
    players: [
      "Rafael Nadal", "Novak Djokovic", "Roger Federer", "Richard Gasquet",
      "Stanislas Wawrinka", "Andy Murray", "Tomas Berdych", "Marcel Granollers",
      "David Ferrer", "Tommy Robredo", "Mikhail Youzhny", "Lleyton Hewitt",
      "Philipp Kohlschreiber", "Leonardo Mayer", "John Isner", "Marin Cilic"
    ]
  },
  {
    tournament: "Australian Open",
    year: 2014,
    surface: "hard",
    players: [
      "Stanislas Wawrinka", "Rafael Nadal", "Roger Federer", "Andy Murray",
      "Novak Djokovic", "Tomas Berdych", "David Ferrer", "Jo-Wilfried Tsonga",
      "Grigor Dimitrov", "Roberto Bautista Agut", "Kei Nishikori", "Juan Martin del Potro",
      "Kevin Anderson", "Fabio Fognini", "Tommy Robredo", "Gael Monfils"
    ]
  },
  {
    tournament: "Roland Garros",
    year: 2014,
    surface: "clay",
    players: [
      "Rafael Nadal", "Novak Djokovic", "Andy Murray", "Ernests Gulbis",
      "Roger Federer", "Tomas Berdych", "David Ferrer", "Milos Raonic",
      "Jo-Wilfried Tsonga", "Gael Monfils", "Grigor Dimitrov", "Richard Gasquet",
      "Fernando Verdasco", "Leonardo Mayer", "John Isner", "Marin Cilic"
    ]
  },
  {
    tournament: "Wimbledon",
    year: 2014,
    surface: "grass",
    players: [
      "Novak Djokovic", "Roger Federer", "Grigor Dimitrov", "Milos Raonic",
      "Andy Murray", "Nick Kyrgios", "Stanislas Wawrinka", "Rafael Nadal",
      "David Ferrer", "Tomas Berdych", "Kei Nishikori", "Feliciano Lopez",
      "Jo-Wilfried Tsonga", "Roberto Bautista Agut", "Vasek Pospisil", "Kevin Anderson"
    ]
  },
  {
    tournament: "US Open",
    year: 2014,
    surface: "hard",
    players: [
      "Marin Cilic", "Kei Nishikori", "Roger Federer", "Novak Djokovic",
      "Tomas Berdych", "Andy Murray", "Gael Monfils", "David Ferrer",
      "Stanislas Wawrinka", "Tommy Robredo", "Grigor Dimitrov", "Philipp Kohlschreiber",
      "Gilles Simon", "Roberto Bautista Agut", "Jo-Wilfried Tsonga", "Milos Raonic"
    ]
  },
  {
    tournament: "Australian Open",
    year: 2015,
    surface: "hard",
    players: [
      "Novak Djokovic", "Andy Murray", "Stanislas Wawrinka", "Tomas Berdych",
      "Rafael Nadal", "Roger Federer", "Kei Nishikori", "Milos Raonic",
      "Nick Kyrgios", "Grigor Dimitrov", "Gilles Muller", "David Ferrer",
      "Feliciano Lopez", "Roberto Bautista Agut", "Gael Monfils", "Marin Cilic"
    ]
  },
  {
    tournament: "Roland Garros",
    year: 2015,
    surface: "clay",
    players: [
      "Stanislas Wawrinka", "Novak Djokovic", "Andy Murray", "David Ferrer",
      "Rafael Nadal", "Roger Federer", "Jo-Wilfried Tsonga", "Tomas Berdych",
      "Kei Nishikori", "David Goffin", "Gael Monfils", "Jack Sock",
      "Carlos Berlocq", "Nicolas Almagro", "John Isner", "Marin Cilic"
    ]
  },
  {
    tournament: "Wimbledon",
    year: 2015,
    surface: "grass",
    players: [
      "Novak Djokovic", "Roger Federer", "Andy Murray", "Richard Gasquet",
      "Stanislas Wawrinka", "Marin Cilic", "Gilles Simon", "Vasek Pospisil",
      "Kevin Anderson", "Gael Monfils", "Nick Kyrgios", "Rafael Nadal",
      "Jo-Wilfried Tsonga", "David Goffin", "Ivo Karlovic", "John Isner"
    ]
  },
  {
    tournament: "US Open",
    year: 2015,
    surface: "hard",
    players: [
      "Novak Djokovic", "Roger Federer", "Marin Cilic", "Jo-Wilfried Tsonga",
      "Andy Murray", "Kevin Anderson", "Stan Wawrinka", "Rafael Nadal",
      "Feliciano Lopez", "John Isner", "Richard Gasquet", "Tomas Berdych",
      "Nick Kyrgios", "David Goffin", "Roberto Bautista Agut", "Benoit Paire"
    ]
  },
  {
    tournament: "Australian Open",
    year: 2016,
    surface: "hard",
    players: [
      "Novak Djokovic", "Andy Murray", "Roger Federer", "Milos Raonic",
      "Rafael Nadal", "Tomas Berdych", "Kei Nishikori", "Jo-Wilfried Tsonga",
      "David Ferrer", "Gael Monfils", "David Goffin", "John Isner",
      "Gilles Simon", "Roberto Bautista Agut", "Grigor Dimitrov", "Stan Wawrinka"
    ]
  },
  {
    tournament: "Roland Garros",
    year: 2016,
    surface: "clay",
    players: [
      "Novak Djokovic", "Andy Murray", "Dominic Thiem", "Stan Wawrinka",
      "David Goffin", "Jo-Wilfried Tsonga", "Tomas Berdych", "Roberto Bautista Agut",
      "Richard Gasquet", "Rafael Nadal", "Marcel Granollers", "Albert Ramos Vinolas",
      "Ernests Gulbis", "John Isner", "Marin Cilic", "Nick Kyrgios"
    ]
  },
  {
    tournament: "Wimbledon",
    year: 2016,
    surface: "grass",
    players: [
      "Andy Murray", "Milos Raonic", "Roger Federer", "Tomas Berdych",
      "Sam Querrey", "Marin Cilic", "Jo-Wilfried Tsonga", "Richard Gasquet",
      "Novak Djokovic", "Nick Kyrgios", "Lucas Pouille", "Bernard Tomic",
      "Roberto Bautista Agut", "Stan Wawrinka", "Vasek Pospisil", "John Isner"
    ]
  },
  {
    tournament: "US Open",
    year: 2016,
    surface: "hard",
    players: [
      "Stan Wawrinka", "Novak Djokovic", "Kei Nishikori", "Gael Monfils",
      "Lucas Pouille", "Juan Martin del Potro", "Jo-Wilfried Tsonga", "Roberto Bautista Agut",
      "Andy Murray", "Grigor Dimitrov", "Tomas Berdych", "John Isner",
      "Rafael Nadal", "Marin Cilic", "Nick Kyrgios", "Dominic Thiem"
    ]
  },
  {
    tournament: "Australian Open",
    year: 2017,
    surface: "hard",
    players: [
      "Roger Federer", "Rafael Nadal", "Grigor Dimitrov", "David Goffin",
      "Milos Raonic", "Stan Wawrinka", "Gael Monfils", "Kei Nishikori",
      "Andy Murray", "Mischa Zverev", "Jo-Wilfried Tsonga", "Roberto Bautista Agut",
      "Novak Djokovic", "Marin Cilic", "Tomas Berdych", "Richard Gasquet"
    ]
  },
  {
    tournament: "Roland Garros",
    year: 2017,
    surface: "clay",
    players: [
      "Rafael Nadal", "Stan Wawrinka", "Andy Murray", "Dominic Thiem",
      "Novak Djokovic", "Kei Nishikori", "Marin Cilic", "Roberto Bautista Agut",
      "Gael Monfils", "Milos Raonic", "Pablo Carreno Busta", "Albert Ramos Vinolas",
      "Karen Khachanov", "Horacio Zeballos", "John Isner", "Fernando Verdasco"
    ]
  },
  {
    tournament: "Wimbledon",
    year: 2017,
    surface: "grass",
    players: [
      "Roger Federer", "Marin Cilic", "Sam Querrey", "Tomas Berdych",
      "Andy Murray", "Novak Djokovic", "Milos Raonic", "Rafael Nadal",
      "Grigor Dimitrov", "Gilles Muller", "Alexander Zverev", "Roberto Bautista Agut",
      "Benoit Paire", "Jo-Wilfried Tsonga", "Adrian Mannarino", "Gael Monfils"
    ]
  },
  {
    tournament: "US Open",
    year: 2017,
    surface: "hard",
    players: [
      "Rafael Nadal", "Kevin Anderson", "Pablo Carreno Busta", "Juan Martin del Potro",
      "Sam Querrey", "Roger Federer", "Andrey Rublev", "David Goffin",
      "Marin Cilic", "Diego Schwartzman", "John Isner", "Mischa Zverev",
      "Roberto Bautista Agut", "Philipp Kohlschreiber", "Lucas Pouille", "Denis Shapovalov"
    ]
  },
  {
    tournament: "Australian Open",
    year: 2018,
    surface: "hard",
    players: [
      "Roger Federer", "Marin Cilic", "Hyeon Chung", "Kyle Edmund",
      "Rafael Nadal", "Grigor Dimitrov", "Nick Kyrgios", "Tomas Berdych",
      "Novak Djokovic", "David Goffin", "Tennys Sandgren", "Andreas Seppi",
      "Diego Schwartzman", "Pablo Carreno Busta", "Fabio Fognini", "Ivo Karlovic"
    ]
  },
  {
    tournament: "Roland Garros",
    year: 2018,
    surface: "clay",
    players: [
      "Rafael Nadal", "Dominic Thiem", "Marco Cecchinato", "Juan Martin del Potro",
      "Alexander Zverev", "Diego Schwartzman", "Kei Nishikori", "Novak Djokovic",
      "David Goffin", "Richard Gasquet", "Fernando Verdasco", "Roberto Bautista Agut",
      "Marin Cilic", "Fabio Fognini", "John Isner", "Kevin Anderson"
    ]
  },
  {
    tournament: "Wimbledon",
    year: 2018,
    surface: "grass",
    players: [
      "Novak Djokovic", "Kevin Anderson", "Rafael Nadal", "John Isner",
      "Roger Federer", "Kei Nishikori", "Milos Raonic", "Mackenzie McDonald",
      "Juan Martin del Potro", "Gael Monfils", "Adrian Mannarino", "Ernests Gulbis",
      "Nick Kyrgios", "Denis Shapovalov", "Stefanos Tsitsipas", "Karen Khachanov"
    ]
  },
  {
    tournament: "US Open",
    year: 2018,
    surface: "hard",
    players: [
      "Novak Djokovic", "Juan Martin del Potro", "Rafael Nadal", "Kei Nishikori",
      "Roger Federer", "John Millman", "Marin Cilic", "Richard Gasquet",
      "Nick Kyrgios", "Borna Coric", "Philipp Kohlschreiber", "John Isner",
      "Kevin Anderson", "Dominic Thiem", "Stan Wawrinka", "Diego Schwartzman"
    ]
  },
  {
    tournament: "Australian Open",
    year: 2019,
    surface: "hard",
    players: [
      "Novak Djokovic", "Rafael Nadal", "Lucas Pouille", "Stefanos Tsitsipas",
      "Roger Federer", "Tomas Berdych", "Kei Nishikori", "Pablo Carreno Busta",
      "Milos Raonic", "Daniil Medvedev", "Roberto Bautista Agut", "Grigor Dimitrov",
      "Frances Tiafoe", "Alexander Zverev", "Marin Cilic", "Jan-Lennard Struff"
    ]
  },
  {
    tournament: "Roland Garros",
    year: 2019,
    surface: "clay",
    players: [
      "Rafael Nadal", "Dominic Thiem", "Roger Federer", "Novak Djokovic",
      "Alexander Zverev", "Kei Nishikori", "Stan Wawrinka", "Stefanos Tsitsipas",
      "Karen Khachanov", "Juan Martin del Potro", "David Goffin", "Gael Monfils",
      "Corentin Moutet", "Roberto Bautista Agut", "Benoit Paire", "Fabio Fognini"
    ]
  },
  {
    tournament: "Wimbledon",
    year: 2019,
    surface: "grass",
    players: [
      "Novak Djokovic", "Roger Federer", "Rafael Nadal", "Roberto Bautista Agut",
      "Sam Querrey", "Kei Nishikori", "David Goffin", "Guido Pella",
      "Benoit Paire", "Jo-Wilfried Tsonga", "Milos Raonic", "Ugo Humbert",
      "Fernando Verdasco", "Matteo Berrettini", "Jan-Lennard Struff", "Joao Sousa"
    ]
  },
  {
    tournament: "US Open",
    year: 2019,
    surface: "hard",
    players: [
      "Rafael Nadal", "Daniil Medvedev", "Grigor Dimitrov", "Matteo Berrettini",
      "Roger Federer", "Stan Wawrinka", "Gael Monfils", "Novak Djokovic",
      "Alexander Zverev", "Diego Schwartzman", "Marin Cilic", "David Goffin",
      "John Isner", "Nick Kyrgios", "Andrey Rublev", "Denis Shapovalov"
    ]
  },
  {
    tournament: "Australian Open",
    year: 2020,
    surface: "hard",
    players: [
      "Novak Djokovic", "Dominic Thiem", "Roger Federer", "Alexander Zverev",
      "Stan Wawrinka", "Rafael Nadal", "Stefanos Tsitsipas", "Milos Raonic",
      "Nick Kyrgios", "Gael Monfils", "Marin Cilic", "Roberto Bautista Agut",
      "Diego Schwartzman", "Andrey Rublev", "Fabio Fognini", "Tennys Sandgren"
    ]
  },
  {
    tournament: "Roland Garros",
    year: 2020,
    surface: "clay",
    players: [
      "Rafael Nadal", "Novak Djokovic", "Stefanos Tsitsipas", "Diego Schwartzman",
      "Dominic Thiem", "Alexander Zverev", "Jannik Sinner", "Andrey Rublev",
      "Stan Wawrinka", "Hugo Gaston", "Lorenzo Sonego", "Daniel Altmaier",
      "Sebastian Korda", "Roberto Bautista Agut", "Grigor Dimitrov", "Daniil Medvedev"
    ]
  },
  {
    tournament: "Wimbledon",
    year: 2020,
    surface: "grass",
    players: []
  },
  {
    tournament: "US Open",
    year: 2020,
    surface: "hard",
    players: [
      "Dominic Thiem", "Alexander Zverev", "Daniil Medvedev", "Pablo Carreno Busta",
      "Denis Shapovalov", "David Goffin", "Borna Coric", "Andrey Rublev",
      "Felix Auger-Aliassime", "Vasek Pospisil", "Alex de Minaur", "Matteo Berrettini",
      "Cameron Norrie", "Frances Tiafoe", "Jordan Thompson", "Corentin Moutet"
    ]
  },
  {
    tournament: "Australian Open",
    year: 2021,
    surface: "hard",
    players: [
      "Novak Djokovic", "Daniil Medvedev", "Stefanos Tsitsipas", "Aslan Karatsev",
      "Rafael Nadal", "Grigor Dimitrov", "Andrey Rublev", "Alexander Zverev",
      "Fabio Fognini", "Mackenzie McDonald", "Dusan Lajovic", "Felix Auger-Aliassime",
      "Nick Kyrgios", "Matteo Berrettini", "Hombre Filip Krajinovic", "Karen Khachanov"
    ]
  },
  {
    tournament: "Roland Garros",
    year: 2021,
    surface: "clay",
    players: [
      "Novak Djokovic", "Stefanos Tsitsipas", "Rafael Nadal", "Alexander Zverev",
      "Daniil Medvedev", "Diego Schwartzman", "Matteo Berrettini", "Jan-Lennard Struff",
      "Jannik Sinner", "Andrey Rublev", "Cameron Norrie", "Lorenzo Musetti",
      "Alejandro Davidovich Fokina", "Federico Delbonis", "Pablo Carreno Busta", "Roberto Bautista Agut"
    ]
  },
  {
    tournament: "Wimbledon",
    year: 2021,
    surface: "grass",
    players: [
      "Novak Djokovic", "Matteo Berrettini", "Hubert Hurkacz", "Denis Shapovalov",
      "Roger Federer", "Karen Khachanov", "Felix Auger-Aliassime", "Alexander Zverev",
      "Daniil Medvedev", "Marton Fucsovics", "Sebastian Korda", "Cristian Garin",
      "Roberto Bautista Agut", "Ilya Ivashka", "Ugo Humbert", "Lorenzo Sonego"
    ]
  },
  {
    tournament: "US Open",
    year: 2021,
    surface: "hard",
    players: [
      "Daniil Medvedev", "Novak Djokovic", "Felix Auger-Aliassime", "Alexander Zverev",
      "Matteo Berrettini", "Carlos Alcaraz", "Botic van de Zandschulp", "Jannik Sinner",
      "Reilly Opelka", "Lloyd Harris", "Casper Ruud", "Andrey Rublev",
      "Denis Shapovalov", "Oscar Otte", "Peter Gojowczyk", "Jack Sock"
    ]
  },
  {
    tournament: "Australian Open",
    year: 2022,
    surface: "hard",
    players: [
      "Rafael Nadal", "Daniil Medvedev", "Stefanos Tsitsipas", "Matteo Berrettini",
      "Jannik Sinner", "Denis Shapovalov", "Gael Monfils", "Felix Auger-Aliassime",
      "Miomir Kecmanovic", "Adrian Mannarino", "Benoit Paire", "Alex de Minaur",
      "Karen Khachanov", "Roberto Bautista Agut", "Maxime Cressy", "Marin Cilic"
    ]
  },
  {
    tournament: "Roland Garros",
    year: 2022,
    surface: "clay",
    players: [
      "Rafael Nadal", "Casper Ruud", "Alexander Zverev", "Marin Cilic",
      "Novak Djokovic", "Carlos Alcaraz", "Stefanos Tsitsipas", "Holger Rune",
      "Andrey Rublev", "Jannik Sinner", "Hubert Hurkacz", "Felix Auger-Aliassime",
      "Daniil Medvedev", "Frances Tiafoe", "Corentin Moutet", "Botic van de Zandschulp"
    ]
  },
  {
    tournament: "Wimbledon",
    year: 2022,
    surface: "grass",
    players: [
      "Novak Djokovic", "Nick Kyrgios", "Cameron Norrie", "Rafael Nadal",
      "Cristian Garin", "David Goffin", "Jannik Sinner", "Carlos Alcaraz",
      "Stefanos Tsitsipas", "Taylor Fritz", "Brandon Nakashima", "Jason Kubler",
      "Tim van Rijthoven", "Botic van de Zandschulp", "Oscar Otte", "Jiri Vesely"
    ]
  },
  {
    tournament: "US Open",
    year: 2022,
    surface: "hard",
    players: [
      "Carlos Alcaraz", "Casper Ruud", "Karen Khachanov", "Frances Tiafoe",
      "Jannik Sinner", "Nick Kyrgios", "Matteo Berrettini", "Marin Cilic",
      "Rafael Nadal", "Andrey Rublev", "Daniil Medvedev", "Daniel Evans",
      "Corentin Moutet", "Ilya Ivashka", "Borna Coric", "Alex de Minaur"
    ]
  },
  {
    tournament: "Australian Open",
    year: 2023,
    surface: "hard",
    players: [
      "Novak Djokovic", "Stefanos Tsitsipas", "Karen Khachanov", "Tommy Paul",
      "Ben Shelton", "Andrey Rublev", "Jannik Sinner", "Alex de Minaur",
      "Roberto Bautista Agut", "Hubert Hurkacz", "Sebastian Korda", "Felix Auger-Aliassime",
      "Jiri Lehecka", "Enzo Couacaud", "Grigor Dimitrov", "Miomir Kecmanovic"
    ]
  },
  {
    tournament: "Roland Garros",
    year: 2023,
    surface: "clay",
    players: [
      "Novak Djokovic", "Casper Ruud", "Carlos Alcaraz", "Alexander Zverev",
      "Stefanos Tsitsipas", "Holger Rune", "Karen Khachanov", "Tomas Martin Etcheverry",
      "Lorenzo Musetti", "Grigor Dimitrov", "Alejandro Davidovich Fokina", "Francisco Cerundolo",
      "Bernabe Zapata Miralles", "Roberto Bautista Agut", "Daniil Medvedev", "Matteo Berrettini"
    ]
  },
  {
    tournament: "Wimbledon",
    year: 2023,
    surface: "grass",
    players: [
      "Carlos Alcaraz", "Novak Djokovic", "Daniil Medvedev", "Jannik Sinner",
      "Stefanos Tsitsipas", "Andrey Rublev", "Holger Rune", "Roman Safiullin",
      "Christopher Eubanks", "Matteo Berrettini", "Alexander Zverev", "Frances Tiafoe",
      "Grigor Dimitrov", "Ben Shelton", "Tommy Paul", "Alexander Bublik"
    ]
  },
  {
    tournament: "US Open",
    year: 2023,
    surface: "hard",
    players: [
      "Novak Djokovic", "Daniil Medvedev", "Carlos Alcaraz", "Alexander Zverev",
      "Ben Shelton", "Frances Tiafoe", "Andrey Rublev", "Jannik Sinner",
      "Taylor Fritz", "Tommy Paul", "Jack Draper", "Casper Ruud",
      "Grigor Dimitrov", "Alex de Minaur", "Nicolas Jarry", "Jiri Lehecka"
    ]
  },
  {
    tournament: "Australian Open",
    year: 2024,
    surface: "hard",
    players: [
      "Jannik Sinner", "Daniil Medvedev", "Alexander Zverev", "Novak Djokovic",
      "Carlos Alcaraz", "Andrey Rublev", "Hubert Hurkacz", "Tommy Paul",
      "Stefanos Tsitsipas", "Ben Shelton", "Holger Rune", "Grigor Dimitrov",
      "Adrian Mannarino", "Miomir Kecmanovic", "Taylor Fritz", "Jack Draper"
    ]
  },
  {
    tournament: "Roland Garros",
    year: 2024,
    surface: "clay",
    players: [
      "Carlos Alcaraz", "Alexander Zverev", "Jannik Sinner", "Casper Ruud",
      "Stefanos Tsitsipas", "Novak Djokovic", "Grigor Dimitrov", "Alex de Minaur",
      "Holger Rune", "Taylor Fritz", "Hubert Hurkacz", "Tommy Paul",
      "Felix Auger-Aliassime", "Ben Shelton", "Corentin Moutet", "Tomas Martin Etcheverry"
    ]
  },
  {
    tournament: "Wimbledon",
    year: 2024,
    surface: "grass",
    players: [
      "Carlos Alcaraz", "Novak Djokovic", "Daniil Medvedev", "Lorenzo Musetti",
      "Jannik Sinner", "Ben Shelton", "Taylor Fritz", "Alexander Zverev",
      "Grigor Dimitrov", "Alex de Minaur", "Tommy Paul", "Roberto Bautista Agut",
      "Ugo Humbert", "Denis Shapovalov", "Giovanni Mpetshi Perricard", "Brandon Nakashima"
    ]
  },
  {
    tournament: "US Open",
    year: 2024,
    surface: "hard",
    players: [
      "Jannik Sinner", "Taylor Fritz", "Frances Tiafoe", "Jack Draper",
      "Daniil Medvedev", "Alexander Zverev", "Novak Djokovic", "Carlos Alcaraz",
      "Andrey Rublev", "Grigor Dimitrov", "Alex de Minaur", "Tommy Paul",
      "Casper Ruud", "Brandon Nakashima", "Alexei Popyrin", "Nuno Borges"
    ]
  }
];
