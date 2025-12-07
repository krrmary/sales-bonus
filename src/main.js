/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
    const { discount, sale_price, quantity } = purchase;

    // Защита от некорректных значений
    if (
        typeof sale_price !== "number" ||
        typeof quantity !== "number" ||
        typeof discount !== "number"
    ) {
        return 0;
    }

    // Коэффициент для расчёта суммы БЕЗ скидки (т.е. доля от полной цены, которую заплатил клиент)
    const discountFactor = 1 - discount / 100;

    // Выручка = цена × количество × коэффициент (после скидки)
    const revenue = sale_price * quantity * discountFactor;

    return revenue;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    if (total <= 0 || index < 0 || index >= total) {
        return 0;
    }

    if (index === 0) {
        return 0.15; // 15% — 1-е место
    } else if (index === 1 || index === 2) {
        return 0.1; // 10% — 2-е и 3-е места
    } else if (index === total - 1) {
        return 0; // 0% — последнее место
    } else {
        return 0.05; // 5% — все остальные
    }
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{seller_id: string, name: string, revenue: number, profit: number, sales_count: number, bonus_rate: number, bonus_amount: number}[]}
 */
function analyzeSalesData(data, options) {
    // 1. Проверка входных данных
    if (
        !data ||
        !Array.isArray(data.sellers) ||
        !Array.isArray(data.products) ||
        !Array.isArray(data.purchase_records) ||
        data.sellers.length === 0 ||
        data.products.length === 0 ||
        data.purchase_records.length === 0
    ) {
        throw new Error(
            "Некорректные входные данные: ожидается объект с непустыми массивами sellers, products и purchase_records"
        );
    }

    // 2. Проверка опций
    if (typeof options !== "object" || options === null) {
        throw new Error("Опции должны быть объектом");
    }
    const { calculateRevenue, calculateBonus } = options;
    if (
        typeof calculateRevenue !== "function" ||
        typeof calculateBonus !== "function"
    ) {
        throw new Error(
            "Опции должны содержать функции calculateRevenue и calculateBonus"
        );
    }

    // 3. Подготовка промежуточной статистики
    const sellerStats = data.sellers.map((seller) => ({
        id: seller.id,
        name: `${seller.first_name} ${seller.last_name}`,
        revenue: 0, // ← будет увеличиваться на record.total_amount
        profit: 0, // ← будет рассчитываться по товарам
        sales_count: 0, // ← +1 за чек
        products_sold: {},
    }));

    // 4. Создание индексов (объектов для быстрого доступа)
    const sellerIndex = Object.fromEntries(
        sellerStats.map((stat) => [stat.id, stat])
    );
    const productIndex = Object.fromEntries(
        data.products.map((product) => [product.sku, product])
    );

    // 5. Агрегация: перебор чеков и товаров
    data.purchase_records.forEach((record) => {
        const seller = sellerIndex[record.seller_id];
        if (!seller) return;

        seller.sales_count += 1;
        seller.revenue += record.total_amount;

        record.items.forEach((item) => {
            const product = productIndex[item.sku];
            if (!product) return;

            const cost = product.purchase_price * item.quantity;
            const revenue = calculateRevenue(item, product);
            const profit = revenue - cost;

            seller.profit += profit;

            // Увеличить счётчик числа проданных товаров
            if (!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
            }
            seller.products_sold[item.sku] += item.quantity;
        });
    });

    // 6. Сортировка по прибыли
    const sortedSellers = sellerStats.sort((a, b) => b.profit - a.profit);
    const total = sortedSellers.length;

    sellerStats.forEach((seller, index) => {
        // 1. Считаем бонус
        const bonusRate = calculateBonus(index, total, seller);
        seller.bonus = seller.profit * bonusRate; // ← здесь рубли

        // 2. Формируем топ-10 проданных товаров — СТРОГО ПО ТЗ
        seller.top_products = Object.entries(seller.products_sold)
            .map(([sku, quantity]) => ({ sku, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);
    });

    return sellerStats.map((seller) => ({
        seller_id: seller.id,
        name: seller.name,
        revenue: +seller.revenue.toFixed(2),
        profit: +seller.profit.toFixed(2),
        sales_count: seller.sales_count,
        top_products: seller.top_products,
        bonus: +seller.bonus.toFixed(2),
    }));
}
