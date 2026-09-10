// Le moteur de calcul en mode Pokémon Champions : génération 0 de @smogon/calc (construit depuis le GitHub de Showdown,
// voir scripts/build-engine.sh). Elle contient le pool, les attaques, objets et talents de Champions, les changements
// de puissance propres à Champions (Acide Malique 90, Charge Glaive...) et les formules de dégâts de Champions.
// Les Points de Stat (SP) s'y utilisent directement (0 à 32), niveau 50 et IV ignorés.
import { Generations } from '@smogon/calc'

export const gen = Generations.get(0)
