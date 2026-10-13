-- Panelden format kararı (Stüdyo → Formatlar): 'sabit' her turda kreatif
-- direktöre gider, 'kapali' hiç gitmez. NULL: ajan kendisi karar verir.
-- Ayrı sütun: söküm formatı yeniden gördüğünde durum'u güncelliyor ama
-- insan kararını ezmiyor.
ALTER TABLE formatlar ADD COLUMN panel_karari TEXT;
