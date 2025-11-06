"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { serializeCarData } from "@/lib/helpers";

export async function getCarFilters() {
  try {
    const [makes, bodyTypes, fuelTypes, transmissions, priceRange] = await Promise.all([
      db.car.findMany({
        select: { make: true },
        distinct: ["make"],
        orderBy: { make: "asc" },
      }),
      db.car.findMany({
        select: { bodyType: true },
        distinct: ["bodyType"],
        orderBy: { bodyType: "asc" },
      }),
      db.car.findMany({
        select: { fuelType: true },
        distinct: ["fuelType"],
        orderBy: { fuelType: "asc" },
      }),
      db.car.findMany({
        select: { transmission: true },
        distinct: ["transmission"],
        orderBy: { transmission: "asc" },
      }),
      db.car.aggregate({
        _min: { price: true },
        _max: { price: true },
      }),
    ]);

    return {
      success: true,
      data: {
        makes: makes.map(item => item.make),
        bodyTypes: bodyTypes.map(item => item.bodyType),
        fuelTypes: fuelTypes.map(item => item.fuelType),
        transmissions: transmissions.map(item => item.transmission),
        priceRange: {
          min: priceRange._min.price ? parseFloat(priceRange._min.price.toString()) : 0,
          max: priceRange._max.price ? parseFloat(priceRange._max.price.toString()) : 100000,
        },
      },
    };
  } catch (error) {
    console.error("Error fetching filters:", error);
    return {
      success: false,
      data: {
        makes: [],
        bodyTypes: [],
        fuelTypes: [],
        transmissions: [],
        priceRange: { min: 0, max: 100000 },
      },
    };
  }
}

export async function getFilteredCars(filters = {}) {
  try {
    const { userId } = await auth();
    
    const where = {
      status: "AVAILABLE",
    };

    if (filters.make) {
      where.make = Array.isArray(filters.make) ? { in: filters.make } : { equals: filters.make };
    }
    if (filters.bodyType) {
      where.bodyType = Array.isArray(filters.bodyType) ? { in: filters.bodyType } : { equals: filters.bodyType };
    }
    if (filters.fuelType) {
      where.fuelType = Array.isArray(filters.fuelType) ? { in: filters.fuelType } : { equals: filters.fuelType };
    }
    if (filters.transmission) {
      where.transmission = Array.isArray(filters.transmission) ? { in: filters.transmission } : { equals: filters.transmission };
    }
    if (filters.minPrice || filters.maxPrice) {
      where.price = {};
      if (filters.minPrice) where.price.gte = filters.minPrice;
      if (filters.maxPrice) where.price.lte = filters.maxPrice;
    }
    if (filters.search) {
      where.OR = [
        { make: { contains: filters.search, mode: "insensitive" } },
        { model: { contains: filters.search, mode: "insensitive" } },
        { color: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const limit = filters.limit || 20;
    const page = filters.page || 1;
    const skip = (page - 1) * limit;

    const [cars, totalCount] = await Promise.all([
      db.car.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      }),
      db.car.count({ where })
    ]);

    let savedCarIds = [];
    if (userId) {
      const user = await db.user.findUnique({
        where: { clerkUserId: userId },
        select: {
          savedCars: {
            select: { carId: true },
          },
        },
      });
      savedCarIds = user?.savedCars.map(sc => sc.carId) || [];
    }

    const serializedCars = cars.map(car => 
      serializeCarData(car, savedCarIds.includes(car.id))
    );

    const totalPages = Math.ceil(totalCount / limit);

    return {
      success: true,
      data: serializedCars,
      pagination: {
        total: totalCount,
        pages: totalPages,
        currentPage: page,
        limit
      }
    };
  } catch (error) {
    console.error("Error fetching filtered cars:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function toggleSavedCar(carId) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User not found");

    const existingSave = await db.userSavedCar.findUnique({
      where: {
        userId_carId: {
          userId: user.id,
          carId: carId,
        },
      },
    });

    if (existingSave) {
      await db.userSavedCar.delete({
        where: { id: existingSave.id },
      });
      return {
        success: true,
        saved: false,
        message: "Car removed from favorites",
      };
    } else {
      await db.userSavedCar.create({
        data: {
          userId: user.id,
          carId: carId,
        },
      });
      return {
        success: true,
        saved: true,
        message: "Car added to favorites",
      };
    }
  } catch (error) {
    console.error("Error toggling saved car:", error);
    throw new Error("Failed to update favorites");
  }
}

export async function getSavedCars() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
      include: {
        savedCars: {
          include: {
            car: true,
          },
        },
      },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    const savedCars = user.savedCars.map(savedCar => 
      serializeCarData(savedCar.car, true)
    );

    return {
      success: true,
      data: savedCars,
    };
  } catch (error) {
    console.error("Error fetching saved cars:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function getCarById(id) {
  try {
    const { userId } = await auth();
    
    const car = await db.car.findUnique({
      where: { id },
    });

    if (!car) {
      return { success: false, error: "Car not found" };
    }

    let isWishlisted = false;
    if (userId) {
      const user = await db.user.findUnique({
        where: { clerkUserId: userId },
      });
      
      if (user) {
        const savedCar = await db.userSavedCar.findUnique({
          where: {
            userId_carId: {
              userId: user.id,
              carId: id,
            },
          },
        });
        isWishlisted = !!savedCar;
      }
    }

    return {
      success: true,
      data: serializeCarData(car, isWishlisted),
    };
  } catch (error) {
    console.error("Error fetching car:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}