#!/usr/bin/env node

/**
 * Script para actualizar descripciones de archivos existentes
 * Genera automáticamente descripciones detalladas para todos los archivos
 * que no tengan descripción o tengan descripciones muy cortas
 */

const { supabaseDB } = require('../src/supabaseClient');

const generateAutoDescription = (fileName, category, type = 'free') => {
  const cleanName = String(fileName || '').trim();
  const categoryMap = {
    'amor': 'romántica',
    'amistad': 'amistad',
    'romance': 'romántica',
    'otro': 'HTML',
  };
  const categoryLabel = categoryMap[String(category || '').toLowerCase()] || 'HTML';
  
  const typeLabel = type === 'vip' ? 'Premium VIP' : 'Gratis';
  
  const baseDescription = `Descarga gratis la plantilla HTML "${cleanName}" ahora totalmente disponible en SysteCode. `;
  
  const categoryDescription = category && String(category).toLowerCase() !== 'otro' 
    ? `Archivo ${categoryLabel} completamente editable y personalizable. `
    : `Archivo HTML de calidad completamente editable y personalizable. `;
  
  const featuresDescription = `Código HTML limpio, bien estructurado y fácil de modificar. Plantilla ${typeLabel} lista para usar, dedicar, compartir o completamente personalizable según tus necesidades. `;
  
  const benefitsDescription = `Puedes cambiar colores, textos, imágenes y estilos sin necesidad de conocimientos avanzados de programación. Ideal para crear páginas web personalizadas, dedicatorias, invitaciones, cartas digitales, landings o cualquier proyecto creativo. `;
  
  const technicalDescription = `Plantilla totalmente responsive, compatible con todos los navegadores modernos (Chrome, Firefox, Safari, Edge). Código optimizado para carga rápida y SEO-friendly. `;
  
  const conclusionDescription = `Descarga ${cleanName} ahora mismo y comienza a personalizar tu proyecto. Archivos limpios, modernos y funcionales para tus necesidades de desarrollo web. ¡Únete a miles de usuarios que ya disfrutan de nuestras plantillas en SysteCode!`;
  
  return baseDescription + categoryDescription + featuresDescription + benefitsDescription + technicalDescription + conclusionDescription;
};

async function updateDescriptions() {
  try {
    console.log('🔄 Obteniendo archivos sin descripción o con descripciones cortas...');
    
    // Obtener todos los archivos
    const { data: files, error: fetchError } = await supabaseDB
      .from('html_files')
      .select('id, filename, categoria, tipo')
      .order('id', { ascending: false });
    
    if (fetchError) {
      console.error('❌ Error al obtener archivos:', fetchError);
      return;
    }
    
    if (!files || files.length === 0) {
      console.log('ℹ️  No hay archivos para procesar');
      return;
    }
    
    console.log(`📊 Total de archivos encontrados: ${files.length}`);
    
    // Filtrar archivos que necesitan descripción
    const filesToUpdate = files.filter(f => {
      const desc = String(f.descripcion || '').trim();
      return !desc || desc.length < 50; // Si está vacío o es muy corto
    });
    
    console.log(`📝 Archivos a actualizar: ${filesToUpdate.length}`);
    
    if (filesToUpdate.length === 0) {
      console.log('✅ Todos los archivos ya tienen descripciones adecuadas');
      return;
    }
    
    // Actualizar descripciones
    let updated = 0;
    let errors = 0;
    
    for (const file of filesToUpdate) {
      try {
        const newDescription = generateAutoDescription(
          file.filename,
          file.categoria,
          String(file.tipo || '').toLowerCase()
        );
        
        const { error: updateError } = await supabaseDB
          .from('html_files')
          .update({ descripcion: newDescription })
          .eq('id', file.id);
        
        if (updateError) {
          console.error(`❌ Error al actualizar archivo ${file.id}:`, updateError.message);
          errors++;
        } else {
          console.log(`✅ Actualizado: ${file.filename} (ID: ${file.id})`);
          updated++;
        }
      } catch (err) {
        console.error(`❌ Excepción al procesar archivo ${file.id}:`, err.message);
        errors++;
      }
    }
    
    console.log(`\n📊 Resultados:`);
    console.log(`   ✅ Actualizados exitosamente: ${updated}`);
    console.log(`   ❌ Errores: ${errors}`);
    console.log(`   📦 Total procesados: ${updated + errors}`);
    
  } catch (err) {
    console.error('❌ Error inesperado:', err);
  } finally {
    process.exit(0);
  }
}

// Ejecutar
updateDescriptions();
