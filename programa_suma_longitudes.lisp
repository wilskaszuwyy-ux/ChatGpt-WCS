; ============================================================
; AutoLISP para AutoCAD
; Archivo: programa_suma_longitudes.lisp
;
; OBJETIVO
;   Sumar longitudes de dos tipos de objetos:
;   1) LINE        -> usando su geometría (punto inicial y final)
;   2) DIMENSION   -> usando la propiedad Measurement de AutoCAD
;
; REGLA PRINCIPAL
;   El usuario SOLO puede seleccionar LINEAS o COTAS.
;   Para garantizarlo, se usa un filtro de selección en ssget:
;     '((0 . "LINE,DIMENSION"))
;
; USO
;   1) Cargar este archivo en AutoCAD (APPLOAD)
;   2) Ejecutar el comando: SUMAR_LINEAS_COTAS
;   3) Seleccionar objetos (solo líneas o cotas)
;   4) Revisar los totales en la línea de comandos
; ============================================================

; ------------------------------------------------------------
; Función auxiliar: _obtener-longitud
; ------------------------------------------------------------
; Recibe:
;   ent -> nombre de entidad (ename)
;
; Devuelve:
;   - Longitud numérica (real) si la entidad es LINE o DIMENSION
;   - 0.0 para cualquier otro caso (respaldo de seguridad)
;
; Nota:
;   Aunque la selección ya filtra tipos válidos, este control
;   adicional evita errores si la función se reutiliza en otro contexto.
; ------------------------------------------------------------
(defun _obtener-longitud (ent / data tipo p1 p2 obj)
  ; Leer la lista DXF de la entidad y su tipo (grupo 0)
  (setq data (entget ent)
        tipo (cdr (assoc 0 data)))

  ; Elegir cálculo según el tipo de entidad
  (cond
    ; Caso 1: LINE
    ; Longitud = distancia entre punto inicial (10) y final (11)
    ((= tipo "LINE")
     (setq p1 (cdr (assoc 10 data))
           p2 (cdr (assoc 11 data)))
     (distance p1 p2)
    )

    ; Caso 2: DIMENSION
    ; Se consulta la medida real almacenada por AutoCAD
    ((= tipo "DIMENSION")
     (setq obj (vlax-ename->vla-object ent))
     (vla-get-Measurement obj)
    )

    ; Respaldo para tipos no esperados
    (T 0.0)
  )
)

; ------------------------------------------------------------
; Comando principal: SUMAR_LINEAS_COTAS
; ------------------------------------------------------------
; Flujo:
;   1) Cargar soporte COM (vl-load-com)
;   2) Inicializar acumuladores
;   3) Pedir selección filtrada (solo LINE y DIMENSION)
;   4) Recorrer entidades y acumular por tipo
;   5) Mostrar total de líneas, total de cotas y total general
; ------------------------------------------------------------
(defun c:SUMAR_LINEAS_COTAS (/ ss i ent tipo len total-lineas total-cotas total-general)
  ; Habilitar funciones Visual LISP / COM
  (vl-load-com)

  ; Inicializar acumuladores
  (setq total-lineas 0.0
        total-cotas  0.0)

  ; Solicitar selección con restricción de tipos
  (prompt "\nSelecciona SOLO lineas o cotas: ")
  (setq ss (ssget '((0 . "LINE,DIMENSION"))))

  ; Si hay selección válida, procesar
  (if ss
    (progn
      (setq i 0)

      ; Recorrer el conjunto seleccionado
      (while (< i (sslength ss))
        (setq ent  (ssname ss i)
              tipo (cdr (assoc 0 (entget ent)))
              len  (_obtener-longitud ent))

        ; Acumular por tipo
        (cond
          ((= tipo "LINE")
           (setq total-lineas (+ total-lineas len)))
          ((= tipo "DIMENSION")
           (setq total-cotas (+ total-cotas len)))
        )

        (setq i (1+ i))
      )

      ; Calcular total combinado
      (setq total-general (+ total-lineas total-cotas))

      ; Mostrar resultados (2 decimales)
      (prompt (strcat "\nTotal lineas: " (rtos total-lineas 2 2)))
      (prompt (strcat "\nTotal cotas: " (rtos total-cotas 2 2)))
      (prompt (strcat "\nTOTAL GENERAL: " (rtos total-general 2 2)))
    )

    ; Si no se seleccionó nada o se canceló, informar
    (prompt "\nNo se seleccionaron lineas o cotas.")
  )

  ; Salida limpia del comando
  (princ)
)

; Mensaje al cargar el archivo
(prompt "\nComando cargado: SUMAR_LINEAS_COTAS")
(princ)
