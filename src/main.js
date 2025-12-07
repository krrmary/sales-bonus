/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
    const { discount, sale_price, quantity } = purchase;

    if (
        typeof sale_price !== "number" ||
        typeof quantity !== "number" ||
        typeof discount !== "number"
    ) {
        return 0;
    }

    const discountFactor = 1 - discount / 100;
    const revenue = sale_price * quantity * discountFactor;

    return revenue;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number} — доля бонуса
 */
function calculateBonusByProfit(index, total, seller) {
    if (total <= 0 || index < 0 || index >= total) {
        return 0;
    }

    let rate;
    if (index === 0) {
        rate = 0.15;
    } else if (index === 1 || index === 2) {
        rate = 0.1;
    } else if (index === total - 1) {
        rate = 0;
    } else {
        rate = 0.05;
    }

    // Возвращаем бонус в рублях!
    return seller.profit * rate;
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{
 *   seller_id: string,
 *   name: string,
 *   revenue: number,
 *   profit: number,
 *   sales_count: number,
 *   top_products: any[],
 *   bonus: number
 * }[]}
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
        revenue: 0,
        profit: 0,
        sales_count: 0,
        products_sold: {},
    }));

    // 4. Создание индексов
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

        record.items.forEach((item) => {
            const product = productIndex[item.sku];
            if (!product) return;

            const cost = product.purchase_price * item.quantity;
            const revenue = calculateRevenue(item, product);
            const profit = revenue - cost;

            seller.revenue += revenue;
            seller.profit += profit;

            if (!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
            }
            seller.products_sold[item.sku] += item.quantity;
        });
    });

    // 6. Сортировка по прибыли
    sellerStats.sort((a, b) => b.profit - a.profit);
    const total = sellerStats.length;

    // 7. Назначение бонусов (в рублях) и топ-10 товаров
    sellerStats.forEach((seller, index) => {
    seller.bonus = calculateBonus(index, total, seller); 

    seller.top_products = Object.entries(seller.products_sold)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([sku]) => sku);
});

    // 8. Формирование итогового отчёта
    return sellerStats.map((seller) => ({
        seller_id: seller.id,
        name: seller.name,
        revenue: Number(seller.revenue.toFixed(2)),
        profit: Number(seller.profit.toFixed(2)),
        sales_count: seller.sales_count,
        top_products: seller.top_products, // массив из 10 SKU
        bonus: Number(seller.bonus.toFixed(2)),
    }));
}