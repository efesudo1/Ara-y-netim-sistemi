/**
 * Models Modülü
 * Tüm model sınıflarını export eder
 */

const Arac = require('./Arac.model');
const Tur = require('./Tur.model');
const Guzergah = require('./Guzergah.model');
const AdminKullanici = require('./AdminKullanici.model');

module.exports = {
    Arac,
    Tur,
    Guzergah,
    AdminKullanici
};
