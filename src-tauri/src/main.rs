// Empêche l'ouverture d'une console noire à côté de la fenêtre sous Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    calcritique_lib::run()
}
